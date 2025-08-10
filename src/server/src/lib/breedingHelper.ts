/*
  PalBreeder — two strategies:
  1) "beam" (default): probabilistic beam search with passive pools, rank heuristic, talents at last hop.
  2) "passivesFirst": build a small frontier of candidates that ALREADY include all mandatory + N optional passives
     in their union pools (within a tiny depth), then finalize to desired tribe with talents optimality.

  Key guarantees/fixes carried over:
  - passives on a node = ONLY desired passives we care about; passivePool = the rest (baggage). Final passive prob uses
    union(passives ∪ passivePool) per parent.
  - Passive combinatorics FIX: if K < M + N, that K contributes 0. No down-scaling of N.
  - Talents success: 0 if none parent meets thresholds, 0.3 if one, 0.6 if both (mutation treated as fail).
  - Tribe from (rA,rB) → floor((rA+rB+1)/2) then nearest species by rank (tie → lower rank).
  - Expected time per step = hatch / p_step; for passivesFirst Phase A we do not enforce passives yet → p_step=1.
  - Last-hop optional-present filter: when a single hop can reach desired tribe and N>0, only consider mates whose
    combined union pools contain ≥1 desired non-mandatory.
*/

export type Sex = 'Male' | 'Female'

export interface Talents { hp: number; attack: number; defense: number }

export interface PalInfo {
  id: string
  tribeId: string
  sex: Sex
  talents: Talents
  passives: string[]
  name: string
  tribeName: string,
  level: number,
}

export interface Tribe {
  tribeId: string
  name: string
  combiRank: number
  maleProbability: number
  timeToHatch: number
}

export interface PassiveRequirement { passiveId: string; isMandatory: boolean }
export interface MinTalents { hp: number; attack: number; defense: number }

export type Strategy = 'beam' | 'passivesFirst'

export interface BreedingOptions {
  beamWidthBase: number
  beamWidthPer50Pals: number
  beamWidthMax: number
  topKMates: number
  degradationStepPct: number
  epsilon: number
  minAdditionalDesiredPassives: number
  strategy: Strategy
  // passivesFirst parameters
  phaseAFrontierSize: number // nodes kept per depth in Phase A
  phaseAMaxDepth: number // births to assemble passives (typically 1-2)
  phaseAMatesPerState: number // mates tried per state in Phase A
}

export interface GenealogyNode extends PalInfo {
  parent1?: GenealogyNode
  parent2?: GenealogyNode
  /** desired passives only */
  passives: string[]
  /** other passives (trash/baggage) */
  passivePool?: string[]
}

export interface Step {
  father: GenealogyNode
  mother: GenealogyNode
  passives: string[]
  childTribeId: string
  childTribeName: string
  childCombiRank: number
  requiredSex?: Sex
  pSuccess: number
  expectedTime: number
}

export interface BreedingRoute {
  steps: Step[]
  final: GenealogyNode
  successProbability: number
  expectedTotalTime: number
  degradedTalentFactor?: number
}

export interface FailureResult {
  failure: true
  reason: string
  triedDegradationUpTo: number
}

export class PalBreeder {
  private speciesById: Map<string, Tribe>
  private rankByTribeId: Map<string, number>
  private tribeIdByRank: Map<number, string>
  private sortedRanks: number[]
  private options: BreedingOptions

  constructor(speciesDb: Tribe[], options?: Partial<BreedingOptions>) {
    this.speciesById = new Map(speciesDb.map(t => [t.tribeId, t]))
    this.rankByTribeId = new Map(speciesDb.map(t => [t.tribeId, t.combiRank]))
    this.tribeIdByRank = new Map(speciesDb.map(t => [t.combiRank, t.tribeId]))
    this.sortedRanks = [...this.tribeIdByRank.keys()].sort((a,b)=>a-b)

    this.options = {
      beamWidthBase: 10,
      beamWidthPer50Pals: 5,
      beamWidthMax: 40,
      topKMates: 20,
      degradationStepPct: 10,
      epsilon: 1e-12,
      minAdditionalDesiredPassives: 0,
      strategy: 'beam',
      phaseAFrontierSize: 20,
      phaseAMaxDepth: 2,
      phaseAMatesPerState: 25,
      ...options,
    }
  }

  public GetBestBreedingRoute(
    pals: PalInfo[],
    passiveRequirements: PassiveRequirement[],
    desiredTribeId: string,
    minTalents: MinTalents,
    maxGenerations: number,
    options?: Partial<BreedingOptions>
  ): BreedingRoute | FailureResult {
    const merged: BreedingOptions = { ...this.options, ...options }
    if (!this.speciesById.has(desiredTribeId)) {
      return { failure: true, reason: `Unknown desiredTribeId: ${desiredTribeId}`, triedDegradationUpTo: 0 }
    }

    const beamWidth = Math.min(
      merged.beamWidthMax,
      merged.beamWidthBase + Math.floor(Math.max(0, pals.length - 1) / 50) * merged.beamWidthPer50Pals
    )

    const maxDegrade = 50
    const step = Math.max(1, merged.degradationStepPct | 0)

    for (let d = 0; d <= maxDegrade; d += step) {
      const degradeFactor = d/100
      const thresholds = this.degradeTalents(minTalents, degradeFactor)

      let route: BreedingRoute | undefined
      if (merged.strategy === 'passivesFirst') {
        route = this.searchPassivesFirst(
          pals, passiveRequirements, merged.minAdditionalDesiredPassives,
          desiredTribeId, thresholds, maxGenerations, beamWidth,
          merged.phaseAFrontierSize, merged.phaseAMaxDepth, merged.phaseAMatesPerState
        )
      } else {
        route = this.searchBeam(
          pals, passiveRequirements, merged.minAdditionalDesiredPassives,
          desiredTribeId, thresholds, maxGenerations, beamWidth
        )
      }

      if (route) { if (d>0) route.degradedTalentFactor = degradeFactor; return route }
    }

    return { failure: true, reason: 'No valid route found up to 50% talent degradation', triedDegradationUpTo: 0.5 }
  }

  // =================== Strategy 1: Beam (existing) ===================

  private searchBeam(
    pals: PalInfo[],
    passiveReqs: PassiveRequirement[],
    minAdditionalDesiredPassives: number,
    desiredTribeId: string,
    thresholds: MinTalents,
    maxGenerations: number,
    beamWidth: number
  ): BreedingRoute | undefined {
    const desiredRank = this.rankByTribeId.get(desiredTribeId)!
    const desiredSet = new Set(passiveReqs.map(p => p.passiveId))

    const roots: GenealogyNode[] = pals.map(p => {
      const { desired, trash } = this.splitDesiredAndTrash(p.passives || [], desiredSet)
      return { ...p, passives: desired, passivePool: trash }
    })

    type State = { pal: GenealogyNode; depth: number; pCum: number; timeCum: number; steps: Step[] }
    let beam: State[] = roots.map(r => ({ pal: r, depth: 0, pCum: 1, timeCum: 0, steps: [] }))

    const memo = new Map<string,{time:number;p:number;depth:number}>()

    for (let depth=1; depth<=maxGenerations; depth++) {
      const nextStates: State[] = []
      for (const state of beam) {
        const mates = this.selectTopKMates(state, pals, desiredRank, thresholds, passiveReqs, minAdditionalDesiredPassives, beamWidth)
        for (const m of mates) {
          if (m.sex === state.pal.sex) continue
          const childRank = this.childRank(this.rankOf(state.pal.tribeId), this.rankOf(m.tribeId))
          const childTribeId = this.nearestTribeId(childRank)
          const childTribe = this.speciesById.get(childTribeId)!
          const isFinal = (childTribeId === desiredTribeId)

          const fullA = this.fullPassiveSet(state.pal)
          const fullB = this.fullPassiveSet(m as any as GenealogyNode)

          // last-hop filter: if one hop hits target and N>0, require at least one desired NM present
          if (isFinal && passiveReqs.some(r=>!r.isMandatory) &&
              !this.hasAnyDesiredNM(fullA, fullB, passiveReqs)) {
            continue
          }

          const p_pass = isFinal ? this.pPassives(fullA, fullB, passiveReqs, minAdditionalDesiredPassives) : 1
          const p_tal  = isFinal ? this.pTalents(state.pal.talents, m.talents, thresholds) : 1
          const p_step = p_pass * p_tal
          if (p_step <= 0) continue

          const time = childTribe.timeToHatch / Math.max(p_step, this.options.epsilon)

          const chosenTalents = (isFinal && this.meetsTalents(state.pal.talents, thresholds)) ? state.pal.talents :
                                (isFinal && this.meetsTalents(m.talents, thresholds)) ? m.talents : state.pal.talents

          const child = this.makeChildNode(state.pal, m as any as GenealogyNode, childTribeId, desiredSet, chosenTalents)

          const stepObj: Step = {
            father: state.pal.sex === 'Male' ? state.pal : child.parent2!,
            mother: state.pal.sex === 'Female' ? state.pal : child.parent2!,
            passives: child.passives,
            childTribeId,
            childCombiRank: childRank,
            childTribeName: childTribe.name,
            pSuccess: p_step,
            expectedTime: time,
          }

          const newState: State = { pal: child, depth, pCum: state.pCum*p_step, timeCum: state.timeCum+time, steps: [...state.steps, stepObj] }
          if (this.keepStateBeam(newState, thresholds, memo)) this.tryPush(nextStates, newState, memo, beamWidth)
        }
      }

      nextStates.sort((a,b)=>this.compareStates(a,b,desiredRank,passiveReqs))
      const truncated = nextStates.slice(0, beamWidth)

      let best: State | undefined
      for (const s of truncated) {
        if (this.rankOf(s.pal.tribeId) === desiredRank) { if (!best || s.timeCum < best.timeCum) best = s }
      }
      if (best) {
        return {
          steps: best.steps,
          final: best.pal,
          successProbability: best.steps.reduce((acc, st)=>acc*st.pSuccess, 1),
          expectedTotalTime: best.steps.reduce((acc, st)=>acc+st.expectedTime, 0),
        }
      }
      beam = truncated
    }
    return undefined
  }

  private keepStateBeam(s: { pal: GenealogyNode; depth: number; timeCum: number; pCum: number }, thresholds: MinTalents, memo: Map<string,{time:number;p:number;depth:number}>): boolean {
    const rank = this.rankOf(s.pal.tribeId)
    const talentsClass = this.meetsTalents(s.pal.talents, thresholds) ? 'A' : 'B'
    const poolKey = this.fullPassiveSet(s.pal).slice().sort().join(',')
    const sig = `${rank}|${talentsClass}|${poolKey}|${s.depth}`
    const prev = memo.get(sig)
    if (prev && prev.depth <= s.depth && prev.time <= s.timeCum && prev.p >= s.pCum) return false
    memo.set(sig, { time: s.timeCum, p: s.pCum, depth: s.depth })
    return true
  }

  // =================== Strategy 2: Passives First ===================

  private searchPassivesFirst(
    pals: PalInfo[],
    passiveReqs: PassiveRequirement[],
    minAdditionalDesiredPassives: number,
    desiredTribeId: string,
    thresholds: MinTalents,
    maxGenerations: number,
    beamWidth: number,
    frontierSize: number,
    phaseAMaxDepth: number,
    matesPerState: number
  ): BreedingRoute | undefined {
    const desiredSet = new Set(passiveReqs.map(p=>p.passiveId))
    const desiredRank = this.rankByTribeId.get(desiredTribeId)!

    // Phase A: build a frontier of candidates whose union pools can realize mandatory+N desired
    const roots: GenealogyNode[] = pals.map(p => {
      const { desired, trash } = this.splitDesiredAndTrash(p.passives || [], desiredSet)
      return { ...p, passives: desired, passivePool: trash }
    })

    type AState = { pal: GenealogyNode; depth: number; steps: Step[]; timeCum: number }
    let frontier: AState[] = roots.map(r => ({ pal: r, depth: 0, steps: [], timeCum: 0 }))

    const okAStates: AState[] = []

    for (let d=1; d<=Math.min(phaseAMaxDepth, maxGenerations-1); d++) {
      const next: AState[] = []
      for (const st of frontier) {
        const mates = this.pickMatesPhaseA(st.pal, pals, desiredRank, passiveReqs, minAdditionalDesiredPassives, matesPerState)
        for (const m of mates) {
          if (m.sex === st.pal.sex) continue
          const childRank = this.childRank(this.rankOf(st.pal.tribeId), this.rankOf(m.tribeId))
          const childTribeId = this.nearestTribeId(childRank)
          const childTribe = this.speciesById.get(childTribeId)!

          const child = this.makeChildNode(st.pal, m as any as GenealogyNode, childTribeId, desiredSet)

          const stepObj: Step = {
            father: st.pal.sex === 'Male' ? st.pal : child.parent2!,
            mother: st.pal.sex === 'Female' ? st.pal : child.parent2!,
            passives: child.passives,
            childTribeId,
            childCombiRank: childRank,
            childTribeName: childTribe.name,
            pSuccess: 1, // we don't enforce passives/talents yet in Phase A
            expectedTime: childTribe.timeToHatch,
          }

          const ns: AState = { pal: child, depth: d, steps: [...st.steps, stepObj], timeCum: st.timeCum + stepObj.expectedTime }

          // Check if union pools of ns already suffice for mandatory+N desired with ANY mate in inventory at next hop
          if (this.poolMeetsReqWithAnyMate(child, pals, passiveReqs, minAdditionalDesiredPassives)) {
            okAStates.push(ns)
          }

          next.push(ns)
        }
      }

      // prune frontier — prefer closer ranks and less time
      next.sort((a,b)=>{
        const ar = this.rankOf(a.pal.tribeId), br = this.rankOf(b.pal.tribeId)
        const ad = Math.abs(ar - desiredRank), bd = Math.abs(br - desiredRank)
        if (ad !== bd) return ad - bd
        return a.timeCum - b.timeCum
      })
      frontier = next.slice(0, frontierSize)
    }

    // If Phase A found nothing, bail
    if (okAStates.length === 0) return undefined

    // Phase B: for each A-candidate, finalize to desired tribe in 1 or 2 hops, enforcing passives+talents at final hop
    let bestRoute: BreedingRoute | undefined

    for (const a of okAStates) {
      const route = this.finalizeFromA(a, pals, passiveReqs, minAdditionalDesiredPassives, desiredTribeId, thresholds, maxGenerations - a.depth, beamWidth)
      if (route) {
        if (!bestRoute || route.expectedTotalTime < bestRoute.expectedTotalTime) bestRoute = route
      }
    }

    return bestRoute
  }

  private pickMatesPhaseA(statePal: GenealogyNode, inventory: PalInfo[], desiredRank: number, reqs: PassiveRequirement[], minAdditional: number, limit: number): PalInfo[] {
    const rSelf = this.rankOf(statePal.tribeId)
    const rTarget = desiredRank
    const rMateIdeal = 2*rTarget - 1 - rSelf
    const fullA = this.fullPassiveSet(statePal)

    const scored: { pal: PalInfo; score: number }[] = []
    for (const m of inventory) {
      if (m.id === statePal.id) continue
      if (m.sex === statePal.sex) continue
      const rM = this.rankOf(m.tribeId)
      const rankProx = 1 / (1 + Math.abs(rM - rMateIdeal))
      const fullB = this.fullPassiveSet(m as any as GenealogyNode)
      const pPass = this.pPassives(fullA, fullB, reqs, minAdditional)
      // Phase A focuses on passives proximity + rank closeness
      const score = rankProx*2 + pPass*4
      scored.push({ pal: m, score })
    }
    scored.sort((a,b)=>b.score - a.score)
    return scored.slice(0, limit).map(s=>s.pal)
  }

  private poolMeetsReqWithAnyMate(node: GenealogyNode, inventory: PalInfo[], reqs: PassiveRequirement[], minAdditional: number): boolean {
    const fullA = this.fullPassiveSet(node)
    for (const m of inventory) {
      if (m.sex === node.sex) continue // potential mate for next hop must be opposite to use child directly
      const fullB = this.fullPassiveSet(m as any as GenealogyNode)
      const p = this.pPassives(fullA, fullB, reqs, minAdditional)
      if (p > 0) return true
    }
    return false
  }

  private finalizeFromA(
    aState: { pal: GenealogyNode; depth: number; steps: Step[]; timeCum: number },
    inventory: PalInfo[],
    reqs: PassiveRequirement[],
    minAdditional: number,
    desiredTribeId: string,
    thresholds: MinTalents,
    remainingGenerations: number,
    beamWidth: number
  ): BreedingRoute | undefined {
    if (remainingGenerations <= 0) return undefined
    const desiredRank = this.rankByTribeId.get(desiredTribeId)!
    const desiredSet = new Set(reqs.map(p=>p.passiveId))

    type BState = { pal: GenealogyNode; steps: Step[]; timeCum: number; depth: number }
    let beam: BState[] = [{ pal: aState.pal, steps: [...aState.steps], timeCum: aState.timeCum, depth: 0 }]

    for (let d=1; d<=remainingGenerations; d++) {
      const next: BState[] = []
      for (const st of beam) {
        const mates = this.selectTopKMates({ pal: st.pal }, inventory, desiredRank, thresholds, reqs, minAdditional, beamWidth)
        for (const m of mates) {
          if (m.sex === st.pal.sex) continue
          const childRank = this.childRank(this.rankOf(st.pal.tribeId), this.rankOf(m.tribeId))
          const childTribeId = this.nearestTribeId(childRank)
          const childTribe = this.speciesById.get(childTribeId)!
          const isFinal = (childTribeId === desiredTribeId)

          const fullA = this.fullPassiveSet(st.pal)
          const fullB = this.fullPassiveSet(m as any as GenealogyNode)

          if (isFinal && reqs.some(r=>!r.isMandatory) && !this.hasAnyDesiredNM(fullA, fullB, reqs)) continue

          const p_pass = isFinal ? this.pPassives(fullA, fullB, reqs, minAdditional) : 1
          const p_tal  = isFinal ? this.pTalents(st.pal.talents, m.talents, thresholds) : 1
          const p_step = p_pass * p_tal
          if (p_step <= 0) continue

          const time = childTribe.timeToHatch / Math.max(p_step, this.options.epsilon)

          const chosenTalents = (isFinal && this.meetsTalents(st.pal.talents, thresholds)) ? st.pal.talents :
                                (isFinal && this.meetsTalents(m.talents, thresholds)) ? m.talents : st.pal.talents
          const child = this.makeChildNode(st.pal, m as any as GenealogyNode, childTribeId, desiredSet, chosenTalents)

          const stepObj: Step = {
            father: st.pal.sex === 'Male' ? st.pal : child.parent2!,
            mother: st.pal.sex === 'Female' ? st.pal : child.parent2!,
            passives: child.passives,
            childTribeId,
            childTribeName: childTribe.name,
            childCombiRank: childRank,
            pSuccess: p_step,
            expectedTime: time,
          }

          next.push({ pal: child, steps: [...st.steps, stepObj], timeCum: st.timeCum + time, depth: d })
        }
      }

      // choose best candidates by time and closeness
      next.sort((a,b)=>{
        const ar = this.rankOf(a.pal.tribeId), br = this.rankOf(b.pal.tribeId)
        const ad = Math.abs(ar - desiredRank), bd = Math.abs(br - desiredRank)
        if (ad !== bd) return ad - bd
        return a.timeCum - b.timeCum
      })
      const truncated = next.slice(0, beamWidth)

      // check finals
      let best: BState | undefined
      for (const s of truncated) {
        if (this.rankOf(s.pal.tribeId) === desiredRank) { if (!best || s.timeCum < best.timeCum) best = s }
      }
      if (best) {
        return {
          steps: best.steps,
          final: best.pal,
          successProbability: best.steps.reduce((acc, st)=>acc*st.pSuccess, 1),
          expectedTotalTime: best.steps.reduce((acc, st)=>acc+st.expectedTime, 0),
        }
      }

      beam = truncated
    }

    return undefined
  }

  // =================== Shared helpers ===================

  private hasAnyDesiredNM(fullA: string[], fullB: string[], reqs: PassiveRequirement[]): boolean {
    const desiredNM = reqs.filter(r=>!r.isMandatory).map(r=>r.passiveId)
    for (const id of desiredNM) if (fullA.includes(id) || fullB.includes(id)) return true
    return false
  }

  private selectTopKMates(
    state: { pal: GenealogyNode },
    inventory: PalInfo[],
    desiredRank: number,
    thresholds: MinTalents,
    passiveReqs: PassiveRequirement[],
    minAdditionalDesiredPassives: number,
    limit: number
  ): PalInfo[] {
    const rSelf = this.rankOf(state.pal.tribeId)
    const rTarget = desiredRank
    const rMateIdeal = 2*rTarget - 1 - rSelf

    const scored: { pal: PalInfo; score: number }[] = []
    const poolAFull = this.fullPassiveSet(state.pal)

    for (const m of inventory) {
      if (m.id === state.pal.id) continue
      if (m.sex === state.pal.sex) continue
      const rM = this.rankOf(m.tribeId)
      const rankProx = 1 / (1 + Math.abs(rM - rMateIdeal))

      const poolBFull = this.fullPassiveSet(m as any as GenealogyNode)
      const pPass = this.pPassives(poolAFull, poolBFull, passiveReqs, minAdditionalDesiredPassives)
      const talentsOK = this.meetsTalents(m.talents, thresholds) ? 1 : 0

      const score = rankProx*2 + pPass*3 + talentsOK*1
      scored.push({ pal: m, score })
    }

    scored.sort((a,b)=>b.score - a.score)
    return scored.slice(0, Math.min(limit, this.options.topKMates)).map(s=>s.pal)
  }

  private compareStates(a: { pal: GenealogyNode; timeCum: number }, b: { pal: GenealogyNode; timeCum: number }, desiredRank: number, passiveReqs: PassiveRequirement[]): number {
    const ar = this.rankOf(a.pal.tribeId)
    const br = this.rankOf(b.pal.tribeId)
    const aValid = ar === desiredRank
    const bValid = br === desiredRank
    if (aValid !== bValid) return aValid ? -1 : 1
    if (a.timeCum !== b.timeCum) return a.timeCum - b.timeCum
    const aProx = Math.abs(ar - desiredRank)
    const bProx = Math.abs(br - desiredRank)
    if (aProx !== bProx) return aProx - bProx

    // tie-breaker: prioritize nodes holding more desired passives (by priority order)
    const desiredList = passiveReqs.map(p=>p.passiveId)
    const w = (i:number)=>1/(1+i)
    const aScore = desiredList.reduce((acc,id,idx)=>acc + (a.pal.passives.includes(id)?w(idx):0),0)
    const bScore = desiredList.reduce((acc,id,idx)=>acc + (b.pal.passives.includes(id)?w(idx):0),0)
    return bScore - aScore
  }

  // =================== Probability & math ===================

  private pPassives(poolA: string[], poolB: string[], reqs: PassiveRequirement[], minAdditionalDesiredPassives: number): number {
    const poolSet = new Set<string>([...poolA, ...poolB])
    const U = poolSet.size
    if (U === 0) return 0

    const mand = reqs.filter(r=>r.isMandatory).map(r=>r.passiveId)
    const desiredNM = reqs.filter(r=>!r.isMandatory).map(r=>r.passiveId)

    for (const m of mand) if (!poolSet.has(m)) return 0

    const M = mand.length
    const D = desiredNM.filter(id=>poolSet.has(id)).length

    const pk = [0.4,0.3,0.2,0.1] // K=1..4
    let p = 0

    const Nglobal = Math.max(0, minAdditionalDesiredPassives | 0)

    for (let K=1; K<=4; K++) {
      if (K < M + Nglobal) continue // strict requirement
      const remaining = K - M
      const total = this.nCr(U - M, remaining)
      if (total === 0) continue
      const minX = Nglobal
      const maxX = Math.min(D, remaining)
      if (minX > maxX) continue
      let sum = 0
      for (let x=minX; x<=maxX; x++) {
        const chooseDesired = this.nCr(D, x)
        const chooseOther  = this.nCr((U - M) - D, remaining - x)
        sum += chooseDesired * chooseOther
      }
      const pGivenK = sum / total
      p += pk[K-1] * pGivenK
    }
    return p
  }

  private pTalents(a: Talents, b: Talents, thr: MinTalents): number {
    const A = this.meetsTalents(a, thr)
    const B = this.meetsTalents(b, thr)
    if (A && B) return 0.6
    if (A || B) return 0.3
    return 0
  }

  private meetsTalents(t: Talents, thr: MinTalents): boolean {
    return t.hp>=thr.hp && t.attack>=thr.attack && t.defense>=thr.defense
  }

  private rankOf(tribeId: string): number { const r = this.rankByTribeId.get(tribeId); if (r==null) throw new Error(`Unknown tribeId ${tribeId}`); return r }
  private childRank(rA:number, rB:number){ return Math.floor((rA+rB+1)/2) }
  private nearestTribeId(rank:number): string {
    if (this.tribeIdByRank.has(rank)) return this.tribeIdByRank.get(rank)!
    let best = this.sortedRanks[0], bestD = Math.abs(best-rank)
    for (const r of this.sortedRanks){ const d = Math.abs(r-rank); if (d<bestD || (d===bestD && r<best)){ best=r; bestD=d } }
    return this.tribeIdByRank.get(best)!
  }

  private makeChildNode(
    father: GenealogyNode,
    mother: GenealogyNode | PalInfo,
    childTribeId: string,
    desiredSet: Set<string>,
    talentsForDisplay?: Talents
  ): GenealogyNode {
    const id = `child:${father.id}x${(mother as any).id}/${childTribeId}`
    const fullA = this.fullPassiveSet(father)
    const fullB = this.fullPassiveSet(mother as any)
    const merged = this.unionStrings(fullA, fullB)
    const { desired, trash } = this.splitDesiredAndTrash(merged, desiredSet)

    return {
      id,
      tribeId: childTribeId,
      sex: Math.random()<0.5 ? 'Male':'Female',
      talents: talentsForDisplay || father.talents,
      name: this.speciesById.get(childTribeId)?.name || '',
      tribeName: this.speciesById.get(childTribeId)?.name || '',
      level: 1,
      passives: desired,
      passivePool: trash,
      parent1: father,
      parent2: mother as any,
    }
  }

  // =================== Utils ===================

  private hasDesired(p: string[], desiredSet: Set<string>): boolean { return p.some(x=>desiredSet.has(x)) }
  private unionStrings(a: string[] = [], b: string[] = []): string[] { const s = new Set<string>([...a,...b]); return [...s] }
  private splitDesiredAndTrash(all: string[], desiredSet: Set<string>): { desired: string[]; trash: string[] } {
    const desired: string[] = [], trash: string[] = []
    const seen = new Set<string>()
    for (const p of all){ if (seen.has(p)) continue; seen.add(p); (desiredSet.has(p) ? desired : trash).push(p) }
    return { desired, trash }
  }
  private fullPassiveSet(p: GenealogyNode | PalInfo): string[] {
    const g = p as GenealogyNode
    return this.unionStrings(g.passives || [], g.passivePool || [])
  }

  private nCr(n:number,r:number){ if(r<0||r>n) return 0; if(r===0||r===n) return 1; r=Math.min(r,n-r); let num=1,den=1; for(let i=1;i<=r;i++){ num*=(n-r+i); den*=i } return num/den }
  private degradeTalents(min: MinTalents, factor:number): MinTalents { const s=(x:number)=>Math.floor(x*(1-factor)); return { hp:s(min.hp), attack:s(min.attack), defense:s(min.defense) } }
  private tryPush(next: any[], s:any, _memo: Map<string, any>, beamWidth:number){ if (next.length < beamWidth*5) next.push(s) }
}
