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

import { transformWithEsbuild } from "vite";
import { palDatabase } from "./palDatabase";

let breedingCombinationsCache: Map<string, {parent1: string, parent2: string}[]> | null = null;
let reverseCombinationsCache: Map<string, string> | null = null;

export function getReverseCombinationsMap() : Map<string, string>{
  if(reverseCombinationsCache) return reverseCombinationsCache;
  const map = new Map<string, string>();
console.log('Building breeding combinations cache...');
const exclusiveCombinations = new Map<string, string>();
const exclusiveChildren = new Set<string>();
// Initialize map for all known characters
for (const [_, palData] of Object.entries(palDatabase)) {
    const characterId = palData.Tribe.replace("EPalTribeID::", "");
    if (!map.has([characterId, characterId].join('x'))) {
      map.set([characterId, characterId].join('x'), characterId);
    }
}

// Add explicit combinations from .Combinations in palDatabase
for (const [_, palData] of Object.entries(palDatabase)) {
    for (const combination of palData.Combinations) {
        const childId = combination.ChildCharacterID;
        const parent1 = combination.ParentTribeA;
        const parent2 = combination.ParentTribeB;

        if (!map.has([parent1, parent2].sort().join('x'))) {
            map.set([parent1, parent2].sort().join('x'), childId);
        }
        exclusiveCombinations.set([parent1, parent2].sort().join('x'), childId);
        exclusiveChildren.add(childId);
    }
}
const palEntries = Object.entries(palDatabase);

for (const parent1 of palEntries) {
    for (const parent2 of palEntries) {
      const key = [parent1[0], parent2[0]].sort().join('x');
      if(exclusiveCombinations.has(key)) continue;
      if(map.has(key)) continue;
       const predictedRank = Math.floor((parent1[1].CombiRank + parent2[1].CombiRank + 1) / 2);
       const predictedChild = palEntries
       .filter(a=> !exclusiveChildren.has(a[0]))
       .sort((a, b) => {
           const distanceA = Math.abs(a[1].CombiRank - predictedRank);
           const distanceB = Math.abs(b[1].CombiRank - predictedRank);
           
           // Primary sort: by distance (ascending)
           if (distanceA !== distanceB) {
               return distanceA - distanceB;
           }
           
           // Tie-breaker: by CombiRank (ascending - lowest first)
           return a[1].CombiRank - b[1].CombiRank;
       })[0];

       //console.log({predictedRank, predictedChild});
        map.set(key, predictedChild[0]);
    }
}


// Log statistics
console.log(`${map.size} breeding combinations`);
reverseCombinationsCache = map;
const exclusiveEntries = Array.from(exclusiveCombinations.entries()).slice(0, 30);
console.log('First 10 exclusive entries:', exclusiveEntries);
const mapEntries = Array.from(map.entries()).slice(0, 30);
console.log('First 10 map entries:', mapEntries);
return map;
}
// Build cached breeding combinations map from palDatabase
export function getBreedingCombinationsMap(): Map<string, {parent1: string, parent2: string}[]> {
    if (breedingCombinationsCache) {
        return breedingCombinationsCache;
    }

    console.log('Building breeding combinations cache...');
    const combinationsMap = new Map<string, {parent1: string, parent2: string}[]>();

    const exclusiveCombinations = new Set<string>();
    // Initialize map for all known characters
    for (const [characterId, palData] of Object.entries(palDatabase)) {
        if (!combinationsMap.has(characterId)) {
            combinationsMap.set(characterId, [ { parent1: characterId, parent2: characterId }]);
        }
    }

    // Add explicit combinations from .Combinations in palDatabase
    for (const [characterId, palData] of Object.entries(palDatabase)) {
        for (const combination of palData.Combinations) {
            const childId = combination.ChildCharacterID;
            exclusiveCombinations.add(childId);
            const parent1 = combination.ParentTribeA;
            const parent2 = combination.ParentTribeB;

            if (!combinationsMap.has(childId)) {
                combinationsMap.set(childId, []);
            }
            const existing = combinationsMap.get(childId);
            if (!existing) continue;
            const alreadyExists = existing.some(combo =>
                (combo.parent1 === parent1 && combo.parent2 === parent2) ||
                (combo.parent1 === parent2 && combo.parent2 === parent1)
            );
            if (!alreadyExists) {
                existing.push({ parent1, parent2 });
            }
        }
    }

    // Add CombiRank-based combinations
    const palEntries = Object.entries(palDatabase);

    for (const [parent1Id, parent1Data] of palEntries) {
      for (const [parent2Id, parent2Data] of palEntries) {
        const predictedRank = Math.floor((parent1Data.CombiRank + parent2Data.CombiRank + 1) / 2);
        const predictedChild = palEntries
        .filter(a=> !exclusiveCombinations.has(a[0]))
        .sort((a, b) => {
            const distanceA = Math.abs(a[1].CombiRank - predictedRank);
            const distanceB = Math.abs(b[1].CombiRank - predictedRank);
            
            // Primary sort: by distance (ascending)
            if (distanceA !== distanceB) {
                return distanceA - distanceB;
            }
            
            // Tie-breaker: by CombiRank (ascending - lowest first)
            return a[1].CombiRank - b[1].CombiRank;
        })[0];
        if(predictedChild) {
          if(!combinationsMap.has(predictedChild[0])) {
            combinationsMap.set(predictedChild[0], []);
          }
          const existing = combinationsMap.get(predictedChild[0])!;
          const alreadyExists = existing.some(combo =>
              (combo.parent1 === parent1Id && combo.parent2 === parent2Id) ||
              (combo.parent1 === parent2Id && combo.parent2 === parent1Id)
          );
          if (!alreadyExists) {
              existing.push({ parent1: parent1Id, parent2: parent2Id });
          }
        }
    }
  }

    // Log statistics
    let totalCombinations = 0;
    for (const [characterId, combinations] of combinationsMap) {
        totalCombinations += combinations.length;
        if (combinations.length > 0) {
            console.log(`${characterId}: ${combinations.length} breeding combinations`);
        }
    }

    console.log(`Cached ${totalCombinations} total breeding combinations for ${combinationsMap.size} characters`);

    breedingCombinationsCache = combinationsMap;
    return combinationsMap;
}

type Failure =
  | "NO_PATH"
  | "DEPTH_LIMIT"
  | "MISSING_AB"
  | "SEX_CONSTRAINT"
  | "SELF_BREED_BLOCKED";

type FindResult = { route?: BreedingRoute; why?: Failure };
const DEBUG = false;
const log = (...args: any[]) => { if (DEBUG) console.log(...args); };
type ABMask = 0 | 1 | 2 | 3;
const A_BIT: ABMask = 1;
const B_BIT: ABMask = 2;
const BOTH_BITS: ABMask = 3;

const addMask = (m: ABMask, bit: ABMask): ABMask => ((m | bit) as ABMask);

// If your system decorates IDs, normalize here
const normalizeId = (id: string) => id;

const samePal = (x: PalInfo, y: PalInfo) => x.id === y.id;

const maskOfPal = (p: PalInfo, a: PalInfo, b: PalInfo): ABMask => {
  let m: ABMask = 0;
  if (samePal(p, a)) m = addMask(m, A_BIT);
  if (samePal(p, b)) m = addMask(m, B_BIT);
  return m;
};

function isBreedablePair(a: Sex, b: Sex): boolean {
  if (a === "Neutral" || b === "Neutral") return true;
  return (a === "Male" && b === "Female") || (a === "Female" && b === "Male");
}

function topoStepsFromTree(
  node: GenealogyNode,
  combos: Map<string, { parent1: string; parent2: string }[]>,
  steps: Step[] = []
): Step[] {
  if (!node.parent1 || !node.parent2) return steps;

  // Emit parents first
  topoStepsFromTree(node.parent1, combos, steps);
  topoStepsFromTree(node.parent2, combos, steps);

  // Choose a combination rank that matches this child (first match wins)
  const list = combos.get(node.tribeId) ?? [];
  const idx = list.findIndex(
    p =>
      // we don't know which side is which sex-wise here; rank is just informative
      (p.parent1 === node.parent1!.tribeId && p.parent2 === node.parent2!.tribeId) ||
      (p.parent1 === node.parent2!.tribeId && p.parent2 === node.parent1!.tribeId)
  );

  // Ensure father/mother assignment respects sex (swap if needed).
  let father = node.parent1!;
  let mother = node.parent2!;
  if (!isBreedablePair(father.sex, mother.sex)) {
    // Try swapping
    if (isBreedablePair(mother.sex, father.sex)) {
      [father, mother] = [mother, father];
    } else {
      // Fallback: if both Neutral or both same non-breedable, assign arbitrarily;
      // route construction should already prevent invalid pairs, so this is defensive.
      [father, mother] = [node.parent1!, node.parent2!];
    }
  }

  steps.push({
    father,
    mother,
    passives: node.passives ?? [],
    talents: node.talents ?? {},
    childTribeId: node.tribeId,
    childTribeName: palDatabase[node.tribeId].OverrideNameTextID ?? node.tribeId,
    childCombiRank: idx >= 0 ? idx : 0,
    pSuccess: 1,        // plug in your own success model if available
    expectedTime: 0,    // plug in your timing model if available
  });

  return steps;
}
function pickOwnedLeaf(
  tribeId: string,
  incomingMask: ABMask,
  rootPal: PalInfo,
  virtualPal: PalInfo,
  ownedByTribe: Map<string, PalInfo[]>
): PalInfo | null {
  const owned = ownedByTribe.get(tribeId);
  if (!owned || owned.length === 0) return null;

  if ((incomingMask & A_BIT) === 0) {
    const a = owned.find(o => o.id === rootPal.id);
    if (a) return a;
  }
  if ((incomingMask & B_BIT) === 0) {
    const b = owned.find(o => o.id === virtualPal.id);
    if (b) return b;
  }
  return owned[0];
}
type Candidate = {
  node: GenealogyNode;
  stepsCount: number; // count of emitted steps if linearized
  mask: ABMask;       // whether it includes A and/or B
};

// Prefer fewer steps; tie-breaker can be anything (e.g., lexical)
function better(a?: Candidate, b?: Candidate): Candidate | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.stepsCount !== b.stepsCount) return a.stepsCount < b.stepsCount ? a : b;
  return a; // stable
}

export type Sex = 'Male' | 'Female' | 'Neutral'

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

export type ChildComparator = (a: GenealogyNode, b: GenealogyNode) => number

export interface BreedingOptions {
  beamWidthBase: number
  beamWidthPer50Pals: number
  beamWidthMax: number
  topKMates: number
  degradationStepPct: number
  epsilon: number
  minAdditionalDesiredPassives: number
  strategy: Strategy
  debug: boolean
  phaseAFrontierSize: number
  phaseAMaxDepth: number
  phaseAMatesPerState: number
  childComparator?: ChildComparator
  talentsComparator?: (a: Talents, b: Talents) => number
  findPathMaxDepth: number  // Maximum depth for FindPath method
  desiredSet: Set<string>
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
  talents: Talents
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
  private breedingCombinations: Map<string, {parent1: string, parent2: string}[]>
  private reverseCombinations: Map<string, string>

  constructor(speciesDb: Tribe[], options?: Partial<BreedingOptions>) {
    this.speciesById = new Map(speciesDb.map(t => [t.tribeId, t]))
    this.rankByTribeId = new Map(speciesDb.map(t => [t.tribeId, t.combiRank]))
    this.tribeIdByRank = new Map(speciesDb.map(t => [t.combiRank, t.tribeId]))
    this.sortedRanks = [...this.tribeIdByRank.keys()].sort((a,b)=>a-b)
    this.breedingCombinations = getBreedingCombinationsMap()
    this.reverseCombinations = getReverseCombinationsMap()
    const defaultOptions: BreedingOptions = {
      beamWidthBase: 8,
      beamWidthPer50Pals: 2,
      beamWidthMax: 20,
      topKMates: 20,
      degradationStepPct: 10,
      epsilon: 1e-6,
      minAdditionalDesiredPassives: 0,
      strategy: 'beam',
      debug: false,
      phaseAFrontierSize: 15,
      phaseAMaxDepth: 2,
      phaseAMatesPerState: 10,
      childComparator: undefined,
      findPathMaxDepth: 5,  // Default maximum depth for FindPath,
      desiredSet: new Set<string>(),
    }
    this.options = {
      ...defaultOptions,
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
      const { desired, trash } = this.splitDesiredAndTrash(p.passives || [])
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
          // Only check gender compatibility for non-neutral Pals (root Pals)
          if (m.sex !== 'Neutral' && state.pal.sex !== 'Neutral' && m.sex === state.pal.sex) continue
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

          // Use optimized child generation for final breeding steps to get the best possible offspring
          const child = isFinal 
            ? this.generateOptimalChild(state.pal, m as any as GenealogyNode, childTribeId, passiveReqs, chosenTalents, this.options.childComparator)
            : this.makeChildNode(state.pal, m as any as GenealogyNode, childTribeId)

          const stepObj: Step = {
            father: state.pal.sex === 'Male' ? state.pal : child.parent2!,
            mother: state.pal.sex === 'Female' ? state.pal : child.parent2!,
            passives: child.passives,
            childTribeId,
            childCombiRank: childRank,
            childTribeName: childTribe.name,
            talents: child.talents,
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
        if (this.rankOf(s.pal.tribeId) === desiredRank) { 
          if (!best || this.isStateBetter(s, best, passiveReqs)) best = s 
        }
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
      const { desired, trash } = this.splitDesiredAndTrash(p.passives || [])
      return { ...p, passives: desired, passivePool: trash }
    })

    type AState = { pal: GenealogyNode; depth: number; steps: Step[]; timeCum: number }
    let frontier: AState[] = roots.map(r => ({ pal: r, depth: 0, steps: [], timeCum: 0 }))

    const okAStates: AState[] = []

    let totalIterations = 0
    const maxIterations = 100000 // Increased for deeper search to find more passives
    
    for (let d=1; d<=Math.min(phaseAMaxDepth, maxGenerations-1); d++) {
      const next: AState[] = []
      for (const st of frontier) {
        const mates = this.pickMatesPhaseA(st.pal, pals, desiredRank, passiveReqs, minAdditionalDesiredPassives, matesPerState)
        for (const m of mates) {
          totalIterations++
          if (totalIterations > maxIterations) {
            if (this.options.debug) {
              console.warn(`Breeding algorithm hit iteration limit (${maxIterations}), terminating early. Found ${okAStates.length} valid states so far.`)
            }
            break
          }
          // Only check gender compatibility for non-neutral Pals (root Pals)
          if (m.sex !== 'Neutral' && st.pal.sex !== 'Neutral' && m.sex === st.pal.sex) continue
          const childRank = this.childRank(this.rankOf(st.pal.tribeId), this.rankOf(m.tribeId))
          const childTribeId = this.nearestTribeId(childRank)
          const childTribe = this.speciesById.get(childTribeId)!
          const isFinal = (childTribeId === desiredTribeId)

          const fullA = this.fullPassiveSet(st.pal)
          const fullB = this.fullPassiveSet(m as any as GenealogyNode)

          const p_pass = isFinal ? this.pPassives(fullA, fullB, passiveReqs, minAdditionalDesiredPassives) : 1
          const p_tal  = isFinal ? this.pTalents(st.pal.talents, m.talents, thresholds) : 1
          const p_step = p_pass * p_tal
          if (p_step <= 0) continue

          const time = childTribe.timeToHatch / Math.max(p_step, this.options.epsilon)

          const chosenTalents = (isFinal && this.meetsTalents(st.pal.talents, thresholds)) ? st.pal.talents :
                                (isFinal && this.meetsTalents(m.talents, thresholds)) ? m.talents : st.pal.talents
          const child = isFinal 
                                ? this.generateOptimalChild(st.pal, m as any as GenealogyNode, childTribeId, passiveReqs, chosenTalents, this.options.childComparator)
                                : this.makeChildNode(st.pal, m as any as GenealogyNode, childTribeId)

          const stepObj: Step = {
            father: st.pal.sex === 'Male' ? st.pal : child.parent2!,
            mother: st.pal.sex === 'Female' ? st.pal : child.parent2!,
            talents: child.talents,
            passives: child.passives,
            childTribeId,
            childTribeName: childTribe.name,
            childCombiRank: childRank,
            pSuccess: p_step,
            expectedTime: time,
          }

          const ns: AState = { pal: child, depth: d, steps: [...st.steps, stepObj], timeCum: st.timeCum + stepObj.expectedTime }

          // Check if union pools of ns already suffice for mandatory+N desired with ANY mate in inventory at next hop
          if (this.poolMeetsReqWithAnyMate(child, pals, passiveReqs, minAdditionalDesiredPassives)) {
            okAStates.push(ns)
          }

          next.push(ns)
        }
        if (totalIterations > maxIterations) break
      }
      if (totalIterations > maxIterations) break

      // Computational boundary: limit array size reasonably
      const maxNextSize = Math.min(frontierSize * 3, 200) // Less aggressive limit
      const limitedNext = next.length > maxNextSize ? 
        next.slice(0, maxNextSize) : next

      // Sort with reasonable computational limit
      if (limitedNext.length > 0) {
        limitedNext.sort((a,b)=>{
          const ar = this.rankOf(a.pal.tribeId), br = this.rankOf(b.pal.tribeId)
          const ad = Math.abs(ar - desiredRank), bd = Math.abs(br - desiredRank)
          if (ad !== bd) return ad - bd
          return a.timeCum - b.timeCum
        })
        frontier = limitedNext.slice(0, frontierSize) // Use original frontierSize
      }

    }

    // If Phase A found nothing, bail
    if (this.options.debug) {
      console.log(`Phase A completed: found ${okAStates.length} valid states after ${totalIterations} iterations`)
    }
    if (okAStates.length === 0) {
      if (this.options.debug) {
        console.log('No valid Phase A states found - no breeding routes possible')
      }
      return undefined
    }

    // Phase B: for each A-candidate, finalize to desired tribe in 1 or 2 hops, enforcing passives+talents at final hop
    let bestRoute: BreedingRoute | undefined
    
    // Computational boundary: limit Phase B candidates reasonably
    const maxPhaseBCandidates = Math.min(okAStates.length, 20)
    const limitedOkAStates = okAStates.slice(0, maxPhaseBCandidates)

    if (this.options.debug) {
      console.log(`Phase B: processing ${limitedOkAStates.length} candidates`)
    }
    let routesFound = 0
    for (const a of limitedOkAStates) {
      const route = this.finalizeFromA(a, pals, passiveReqs, minAdditionalDesiredPassives, desiredTribeId, thresholds, maxGenerations - a.depth, Math.min(beamWidth, 15))
      if (route) {
        routesFound++
        if (!bestRoute || this.isRouteBetter(route, bestRoute, passiveReqs)) bestRoute = route
      }
    }
    if (this.options.debug) {
      console.log(`Phase B: found ${routesFound} complete routes from ${limitedOkAStates.length} candidates`)
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
      // Only check gender compatibility for non-neutral Pals (root Pals)
      if (m.sex !== 'Neutral' && statePal.sex !== 'Neutral' && m.sex === statePal.sex) continue
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
    if (remainingGenerations <= 0) {
      if (this.options.debug) {
        console.log(`finalizeFromA: no remaining generations`)
      }
      return undefined
    }
    const desiredRank = this.rankByTribeId.get(desiredTribeId)!
    const desiredSet = new Set(reqs.map(p=>p.passiveId))
    if (this.options.debug) {
      console.log(`finalizeFromA: trying to reach ${desiredTribeId} (rank ${desiredRank}) from ${aState.pal.tribeId} with ${remainingGenerations} generations`)
    }

    type BState = { pal: GenealogyNode; steps: Step[]; timeCum: number; depth: number }
    let beam: BState[] = [{ pal: aState.pal, steps: [...aState.steps], timeCum: aState.timeCum, depth: 0 }]

    for (let d=1; d<=remainingGenerations; d++) {
      const next: BState[] = []
      for (const st of beam) {
        const mates = this.selectTopKMates({ pal: st.pal }, inventory, desiredRank, thresholds, reqs, minAdditional, beamWidth)
        for (const m of mates) {
          // Only check gender compatibility for non-neutral Pals (root Pals)
          if (m.sex !== 'Neutral' && st.pal.sex !== 'Neutral' && m.sex === st.pal.sex) continue
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
          const child = isFinal 
                                ? this.generateOptimalChild(st.pal, m as any as GenealogyNode, childTribeId, reqs, chosenTalents, this.options.childComparator)
                                : this.makeChildNode(st.pal, m as any as GenealogyNode, childTribeId)

          const stepObj: Step = {
            father: st.pal.sex === 'Male' ? st.pal : child.parent2!,
            mother: st.pal.sex === 'Female' ? st.pal : child.parent2!,
            talents: child.talents,
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
        if (this.rankOf(s.pal.tribeId) === desiredRank) { 
          if (!best || this.isStateBetter(s, best, reqs)) best = s 
        }
      }
      
      if (best) {
        if (this.options.debug) {
          console.log(`finalizeFromA: found route to ${desiredTribeId} with ${best.steps.length} steps`)
        }
        return {
          steps: best.steps,
          final: best.pal,
          successProbability: best.steps.reduce((acc, st)=>acc*st.pSuccess, 1),
          expectedTotalTime: best.steps.reduce((acc, st)=>acc+st.expectedTime, 0),
        }
      }

      beam = truncated
    }

    if (this.options.debug) {
      console.log(`finalizeFromA: no route found to ${desiredTribeId}`)
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

    // PRIORITY 1: More desired passives (by priority order and count)
    const desiredList = passiveReqs.map(p=>p.passiveId)
    const w = (i:number)=>1/(1+i)
    const aScore = desiredList.reduce((acc,id,idx)=>acc + (a.pal.passives.includes(id)?w(idx):0),0)
    const bScore = desiredList.reduce((acc,id,idx)=>acc + (b.pal.passives.includes(id)?w(idx):0),0)
    if (aScore !== bScore) return bScore - aScore

    // PRIORITY 2: Time (faster is better, but only as tie-breaker)
    if (a.timeCum !== b.timeCum) return a.timeCum - b.timeCum
    
    // PRIORITY 3: Rank proximity (closer to target rank)
    const aProx = Math.abs(ar - desiredRank)
    const bProx = Math.abs(br - desiredRank)
    return aProx - bProx
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
    childTribeId: string
  ): GenealogyNode {
    const id = `${childTribeId}_${Math.random().toString(36).slice(2, 9)}`
    const fullA = this.fullPassiveSet(father)
    const fullB = this.fullPassiveSet(mother as any)
    const merged = this.unionStrings(fullA, fullB)
    const { desired, trash } = this.splitDesiredAndTrash(merged)

    return {
      id,
      tribeId: childTribeId,
      sex: 'Neutral', // Hypothetical children are always neutral
      talents: [father.talents, mother.talents].sort(this.options.talentsComparator)[0],
      name: this.speciesById.get(childTribeId)?.name || '',
      tribeName: this.speciesById.get(childTribeId)?.name || '',
      level: 1,
      passives: desired,
      passivePool: trash,
      parent1: father,
      parent2: mother as any,
    }
  }

  // =================== Final Child Optimization ===================

  private scoreChild(child: GenealogyNode, passiveReqs: PassiveRequirement[]): number {
    // Score based on number and priority of desired passives
    const desiredList = passiveReqs.map(p => p.passiveId)
    const w = (i: number) => 1 / (1 + i) // Weight by priority order
    
    let score = 0
    for (let i = 0; i < desiredList.length; i++) {
      if (child.passives.includes(desiredList[i])) {
        score += w(i)
      }
    }
    
    // Bonus for having more total desired passives
    score += child.passives.length * 0.1
    
    return score
  }

  private generateOptimalChild(
    father: GenealogyNode,
    mother: GenealogyNode | PalInfo,
    childTribeId: string,
    passiveReqs: PassiveRequirement[],
    talentsForDisplay?: Talents,
    childComparator?: ChildComparator
  ): GenealogyNode {
    const desiredSet = new Set(passiveReqs.map(p => p.passiveId))
    const fullA = this.fullPassiveSet(father)
    const fullB = this.fullPassiveSet(mother as any)
    const merged = this.unionStrings(fullA, fullB)
    const { desired, trash } = this.splitDesiredAndTrash(merged)

    // Generate multiple possible children with different passive combinations
    const possibleChildren: GenealogyNode[] = []
    
    // Simulate the 4 possible passive inheritance scenarios (1-4 passives)
    const allPassives = [...desired, ...trash]
    const passiveCounts = [1, 2, 3, 4]
    
    for (const count of passiveCounts) {
      if (count > allPassives.length) continue
      
      // For each count, try to maximize desired passives
      const combinations = this.generatePassiveCombinations(allPassives, count, desiredSet)
      
      for (const passiveCombination of combinations.slice(0, 3)) { // Limit to top 3 combinations per count
        const childPassives = passiveCombination.filter(p => desiredSet.has(p))
        const childTrash = passiveCombination.filter(p => !desiredSet.has(p))
        
        const child: GenealogyNode = {
          id: `child:${father.id}x${(mother as any).id}/${childTribeId}:${count}`,
          tribeId: childTribeId,
          sex: 'Neutral',
          talents: talentsForDisplay || father.talents,
          name: this.speciesById.get(childTribeId)?.name || '',
          tribeName: this.speciesById.get(childTribeId)?.name || '',
          level: 1,
          passives: childPassives,
          passivePool: childTrash,
          parent1: father,
          parent2: mother as any,
        }
        
        possibleChildren.push(child)
      }
    }
    
    // Select the best child using the provided comparator or fallback to original method
    if (possibleChildren.length === 0) {
      // Fallback to original method
      return this.makeChildNode(father, mother, childTribeId)
    }
    
    if (childComparator) {
      // Use the injected comparator to find the best child
      if (this.options.debug) {
        console.log(`Using custom childComparator to select best child from ${possibleChildren.length} candidates`)
      }
      possibleChildren.sort(childComparator)
      return possibleChildren[0] // Best child after sorting
    } else {
      // Fallback to default scoring if no comparator provided
      let bestChild = possibleChildren[0]
      let bestScore = this.scoreChild(bestChild, passiveReqs)
      
      for (const child of possibleChildren.slice(1)) {
        const score = this.scoreChild(child, passiveReqs)
        if (score > bestScore) {
          bestScore = score
          bestChild = child
        }
      }
      
      return bestChild
    }
  }

  private generatePassiveCombinations(allPassives: string[], count: number, desiredSet: Set<string>): string[][] {
    const combinations: string[][] = []
    const desired = allPassives.filter(p => desiredSet.has(p))
    const trash = allPassives.filter(p => !desiredSet.has(p))
    
    // Prioritize combinations with more desired passives
    for (let desiredCount = Math.min(count, desired.length); desiredCount >= 0; desiredCount--) {
      const trashCount = count - desiredCount
      if (trashCount > trash.length) continue
      
      const desiredCombos = this.getCombinations(desired, desiredCount)
      const trashCombos = trashCount > 0 ? this.getCombinations(trash, trashCount) : [[]]
      
      for (const desiredCombo of desiredCombos) {
        for (const trashCombo of trashCombos) {
          combinations.push([...desiredCombo, ...trashCombo])
        }
      }
      
      // Limit combinations to prevent exponential explosion
      if (combinations.length > 20) break
    }
    
    return combinations
  }

  private getCombinations<T>(array: T[], size: number): T[][] {
    if (size === 0) return [[]]
    if (size > array.length) return []
    
    const result: T[][] = []
    
    function backtrack(start: number, current: T[]) {
      if (current.length === size) {
        result.push([...current])
        return
      }
      
      for (let i = start; i < array.length; i++) {
        current.push(array[i])
        backtrack(i + 1, current)
        current.pop()
      }
    }
    
    backtrack(0, [])
    return result.slice(0, 10) // Limit to prevent performance issues
  }

  // =================== Breeding Combinations ===================

  private getBreedingResult(parent1TribeId: string, parent2TribeId: string): string {
    return this.reverseCombinations.get([parent1TribeId, parent2TribeId].sort().join('x'))!
  }

  private canBreedToTarget(parent1TribeId: string, parent2TribeId: string, targetTribeId: string): boolean {
    return this.getBreedingResult(parent1TribeId, parent2TribeId) === targetTribeId
  }

  // =================== Utils ===================

  private isStateBetter(a: { pal: GenealogyNode; timeCum: number }, b: { pal: GenealogyNode; timeCum: number }, passiveReqs: PassiveRequirement[]): boolean {
    // Calculate passive scores for both states
    const desiredList = passiveReqs.map(p=>p.passiveId)
    const w = (i:number)=>1/(1+i)
    const aScore = desiredList.reduce((acc,id,idx)=>acc + (a.pal.passives.includes(id)?w(idx):0),0)
    const bScore = desiredList.reduce((acc,id,idx)=>acc + (b.pal.passives.includes(id)?w(idx):0),0)
    
    // Performance boundary: if time difference is too large, prioritize time over passives
    const timeDiffThreshold = 3600 * 24 // 24 hours
    if (Math.abs(a.timeCum - b.timeCum) > timeDiffThreshold) {
      return a.timeCum < b.timeCum
    }
    
    // Prioritize higher passive score, then lower time
    if (aScore !== bScore) return aScore > bScore
    return a.timeCum < b.timeCum
  }

  private isRouteBetter(a: BreedingRoute, b: BreedingRoute, passiveReqs: PassiveRequirement[]): boolean {
    // Calculate passive scores for final pals
    const desiredList = passiveReqs.map(p=>p.passiveId)
    const w = (i:number)=>1/(1+i)
    const aScore = desiredList.reduce((acc,id,idx)=>acc + (a.final.passives.includes(id)?w(idx):0),0)
    const bScore = desiredList.reduce((acc,id,idx)=>acc + (b.final.passives.includes(id)?w(idx):0),0)
    
    // Prioritize higher passive score, then lower time
    if (aScore !== bScore) return aScore > bScore
    return a.expectedTotalTime < b.expectedTotalTime
  }

  private hasDesired(p: string[], desiredSet: Set<string>): boolean { return p.some(x=>desiredSet.has(x)) }
  private unionStrings(a: string[] = [], b: string[] = []): string[] { const s = new Set<string>([...a,...b]); return [...s] }
  private splitDesiredAndTrash(all: string[]): { desired: string[]; trash: string[] } {
    const desired: string[] = [], trash: string[] = []
    const seen = new Set<string>()
    for (const p of all){ if (seen.has(p)) continue; seen.add(p); (this.options.desiredSet.has(p) ? desired : trash).push(p) }
    return { desired, trash }
  }
  private fullPassiveSet(p: GenealogyNode | PalInfo): string[] {
    const g = p as GenealogyNode
    return this.unionStrings(g.passives || [], g.passivePool || [])
  }

  private nCr(n:number,r:number){ if(r<0||r>n) return 0; if(r===0||r===n) return 1; r=Math.min(r,n-r); let num=1,den=1; for(let i=1;i<=r;i++){ num*=(n-r+i); den*=i } return num/den }
  private degradeTalents(min: MinTalents, factor:number): MinTalents { const s=(x:number)=>Math.floor(x*(1-factor)); return { hp:s(min.hp), attack:s(min.attack), defense:s(min.defense) } }
  private tryPush(next: any[], s:any, _memo: Map<string, any>, beamWidth:number){ if (next.length < beamWidth*5) next.push(s) }

  public GetBestCombatPal(pals: PalInfo[], maxSteps: number, targetCharacter: string, minTalents: MinTalents): BreedingRoute | FailureResult
  {
    const breedingPool = this.GetBestPassivesRoute(pals, maxSteps);
    console.log(breedingPool[0].passives);
    console.log('Breeding pool', breedingPool.length);
    const palsWithTalents = pals.filter(p=>this.meetsTalents(p.talents, minTalents)).sort((a,b)=> b.talents.attack - a.talents.attack);
    console.log('Talents', palsWithTalents.length);

    const routes : BreedingRoute[] = [];
    for(let passivePal of breedingPool.slice(0,15)){
      for(let talentPal of palsWithTalents.slice(0,15)){
        const route = this.FindPath(talentPal, passivePal, pals, targetCharacter);
        if(route){
          // route.steps = [{
          //   father: passivePal.parent1!,
          //   mother: passivePal.parent2!,
          //   childCombiRank: palDatabase[passivePal.tribeId].CombiRank,
          //   childTribeId: passivePal.tribeId,
          //   passives: passivePal.passives,
          //   childTribeName: palDatabase[passivePal.tribeId].OverrideNameTextID,
          //   talents: this.sumTalents(passivePal.parent1!.talents) > this.sumTalents(passivePal.parent2!.talents) ? passivePal.parent1!.talents : passivePal.parent2!.talents,
          //   pSuccess: 1,
          //   expectedTime: 0,
          // }, ...route.steps]
          return route;
        }
      }
    }
    if(routes.length){
      return routes[0];
    }
    return {
      reason: 'No breeding route found',
      triedDegradationUpTo: 50,
      failure: true
    };
  }
  
  /**
   * GetBestPassivesRoute - Returns a LIST of breeding combinations using different pals with desired passives
   * Ignores talents completely, no targetTribeId - just finds combinations of pals with passives
   * @param pals - Available pal collection
   * @param maxSteps - Maximum number of combinations to return
   * @returns Array of breeding combinations, each showing two pals that can be bred together
   */
  public GetBestPassivesRoute(
    pals: PalInfo[],
    maxSteps: number
  ): GenealogyNode[] {
    
    console.log('Desired passives', this.options.desiredSet)
    // Find ALL pals that have ANY of the desired passives
    let palsWithPassives = pals.filter(pal => 
      pal.passives.some(passive => this.options.desiredSet.has(passive))
    )
    
    if (palsWithPassives.length === 0) {
      return [];
    }
    
    // Sort to prioritize pals with more desired passives
    palsWithPassives.sort((a, b) => {
      const aCount = a.passives.filter(p => this.options.desiredSet.has(p)).length
      const bCount = b.passives.filter(p => this.options.desiredSet.has(p)).length
      return bCount - aCount
    })
    const usedPairs = new Set<string>()
    const pool : GenealogyNode[] = [...pals];
    const key = (child:GenealogyNode) => `${child.tribeId}_${child.passives.join('_')}_${child.passivePool?.length}`;
    const existing = new Set<string>();
    for(let p of pool){
      existing.add(key(p));
    }
    for(let gen = 0; gen < maxSteps; gen++){
      const nextPool : GenealogyNode[] = [];
    // Generate combinations of different pals
    for (const palWithPassive of palsWithPassives) {
      for (const palLambda of pool){
        
        // Skip if same sex (unless one is neutral)
        if (palWithPassive.sex !== 'Neutral' && palLambda.sex !== 'Neutral' && palWithPassive.sex === palLambda.sex) continue
        
        // Create unique pair ID to avoid duplicates
        const pairId = [palWithPassive.id, palLambda.id].sort().join('x')
        if (usedPairs.has(pairId)) continue
        usedPairs.add(pairId)
        
        // Calculate what species would result
        const childTribeId = this.getBreedingResult(palWithPassive.tribeId, palLambda.tribeId)
        const child : GenealogyNode = this.makeChildNode(palWithPassive, palLambda, childTribeId)
        const childKey = key(child);
        if (existing.has(childKey)) continue;
        existing.add(childKey);
        nextPool.push(child);
      }
    }
    console.log({PoolSize: pool.length, NewPool: nextPool.length, Generation: gen});
    pool.push(...nextPool);
  }
    
    palsWithPassives = pool.filter(pal => 
      pal.passives.some(passive => this.options.desiredSet.has(passive))
    );
    palsWithPassives.sort((a, b) => {
      const aCount = a.passives.filter(p => this.options.desiredSet.has(p)).length
      const bCount = b.passives.filter(p => this.options.desiredSet.has(p)).length
      return bCount - aCount
    });
    return palsWithPassives.sort(this.options.childComparator);
  }

  public FindPath(
    rootPal: PalInfo,
    virtualPal: PalInfo,
    roots: PalInfo[],
    targetTribeId: string
  ): BreedingRoute | undefined {
    const res = this.findPathWithReason(rootPal, virtualPal, roots, targetTribeId);
    if (!res.route) {
      log(`[FAIL] reason=${res.why}`);
      return undefined;
    }
    return res.route;
  }

  // same algo but returns failure reason for debugging
  public findPathWithReason(
    rootPal: PalInfo,
    virtualPal: PalInfo,
    roots: PalInfo[],
    targetTribeId: string
  ): FindResult {
    const combos = getBreedingCombinationsMap();

    // Build quick index of owned pals by tribe (A, B, pool). Reuse allowed.
    const ownedByTribe = new Map<string, PalInfo[]>();
    const push = (p: PalInfo) => {
      const arr = ownedByTribe.get(p.tribeId) ?? [];
      arr.push(p);
      ownedByTribe.set(p.tribeId, arr);
    };
    push(rootPal); push(virtualPal); roots.forEach(push);

    const memo = new Map<string, Candidate | null>();
    const key = (t: string, d: number, m: ABMask) => `${t}@@${d}@@${m}`;

    const makeLeaf = (p: PalInfo): Candidate => ({
      node: { ...p },
      stepsCount: 0,
      mask: maskOfPal(p, rootPal, virtualPal),
    });

    const dfs = (
      tribeId: string,
      depth: number,
      mask: ABMask,
      guard: Set<string>
    ): Candidate | null => {
      // If we already own a pal of this tribe, make it a leaf (prefer A/B if missing).
// Mask-gated leaf stopping rule:
// - If A (or B) is available here and its bit is still missing -> TAKE it and stop.
// - If mask already has BOTH bits, we may stop at any owned leaf.
// - Otherwise (mask incomplete and only pool leaves here) -> DO NOT STOP; expand further.
const owned = ownedByTribe.get(tribeId) ?? [];
if (owned.length > 0) {
  const aHere = owned.find(o => o.id === rootPal.id);
  const bHere = owned.find(o => o.id === virtualPal.id);

  if (aHere && (mask & A_BIT) === 0) {
    const leaf = makeLeaf(aHere);
    const newMask = addMask(mask, leaf.mask);
    log?.(`[LEAF] ${tribeId} -> A (${aHere.name}) mask=${newMask}`);
    return { ...leaf, mask: newMask };
  }
  if (bHere && (mask & B_BIT) === 0) {
    const leaf = makeLeaf(bHere);
    const newMask = addMask(mask, leaf.mask);
    log?.(`[LEAF] ${tribeId} -> B (${bHere.name}) mask=${newMask}`);
    return { ...leaf, mask: newMask };
  }

  // Only stop on a non-A/B owned pal if BOTH bits are already satisfied.
  if (mask === BOTH_BITS) {
    const leaf = makeLeaf(owned[0]);
    log?.(`[LEAF] ${tribeId} -> pool (${owned[0].name}) (mask already BOTH)`);
    return { ...leaf, mask };
  }

  // Otherwise: we *could* stop at a pool pal, but that would prevent including A/B.
  // Keep expanding via combos so we can eventually reach A/B tribes.
}

      if (depth <= 0) return null;

      if (guard.has(tribeId)) return null; // avoid tribe cycles
      const memoKey = key(tribeId, depth, mask);
      if (memo.has(memoKey)) return memo.get(memoKey)!;

      const pairs = combos.get(tribeId) ?? [];
      if (pairs.length === 0) { memo.set(memoKey, null); return null; }

      guard.add(tribeId);
      let best: Candidate | null = null;

      for (let i = 0; i < pairs.length; i++) {
        const { parent1, parent2 } = pairs[i];

        const L = dfs(parent1, depth - 1, mask, guard);
        if (!L) continue;
        const R = dfs(parent2, depth - 1, L.mask, guard);
        if (!R) continue;

        // Reject self‑breeding by id (normalized)
        if (normalizeId(L.node.id) === normalizeId(R.node.id)) continue;

        // Reject impossible sexes
        if (!isBreedablePair(L.node.sex, R.node.sex) && !isBreedablePair(R.node.sex, L.node.sex)) {
          continue;
        }

        const child = this.makeChildNode(L.node, R.node, tribeId); 

        const stepsCount = L.stepsCount + R.stepsCount + 1;
        const m = addMask(L.mask, R.mask);
        const cand: Candidate = { node: child, stepsCount, mask: m };

        // Keep shortest
        if (!best || cand.stepsCount < best.stepsCount) best = cand;
      }

      guard.delete(tribeId);
      memo.set(memoKey, best);
      return best;
    };

    let cand = dfs(targetTribeId, this.options.findPathMaxDepth, 0, new Set());

    // Try to inject A/B anywhere (not just leaves)
    if (cand && cand.mask !== BOTH_BITS) {
      const injected = this.injectABAnywhere(cand.node, rootPal, virtualPal);
      if (injected) {
        cand = { ...cand, node: injected, mask: BOTH_BITS };
      }
    }

    const leavesSummary = (n: GenealogyNode) => {
      const out: string[] = [];
      const walk = (x: GenealogyNode) => {
        if (!x.parent1 && !x.parent2) { out.push(`${x.name}[${x.tribeId}]${x.id===rootPal.id?":A":x.id===virtualPal.id?":B":""}`); return; }
        if (x.parent1) walk(x.parent1);
        if (x.parent2) walk(x.parent2);
      };
      walk(n);
      return out.join(", ");
    };
    
    if (!cand) { console.log(`[RESULT] NO_PATH`); return { why: "NO_PATH" }; }
    const steps = this.linearize(cand.node);
    const leavesStr = leavesSummary(cand.node);
    console.log(`[RESULT] steps=${steps.length} leaves=${leavesStr}`);
    
    if (cand.mask !== BOTH_BITS) return { why: "MISSING_AB" };
    const route: BreedingRoute = {
      steps,
      final: cand.node,
      successProbability: steps.reduce((p, s) => p * (s.pSuccess ?? 1), 1),
      expectedTotalTime: steps.reduce((t, s) => t + (s.expectedTime ?? 0), 0),
    };
    return { route };
  }

  private injectABAnywhere(root: GenealogyNode, A: PalInfo, B: PalInfo): GenealogyNode | null {
    let usedA = false, usedB = false;
  
    const walk = (node: GenealogyNode, parent?: GenealogyNode, isLeft?: boolean): GenealogyNode => {
      // Recurse first
      if (node.parent1) node.parent1 = walk(node.parent1, node, true);
      if (node.parent2) node.parent2 = walk(node.parent2, node, false);
  
      // Then try to swap THIS node to A/B if tribe matches and we still need it.
      const sibling = parent ? (isLeft ? parent.parent2 : parent.parent1) : undefined;
  
      // Helper: can we replace this node by pal P without causing self-breed?
      const canReplace = (p: PalInfo) =>
        !sibling || sibling.id !== p.id;
  
      if (!usedA && node.tribeId === A.tribeId && canReplace(A)) {
        usedA = true;
        return { ...(A as GenealogyNode) }; // becomes a leaf
      }
      if (!usedB && node.tribeId === B.tribeId && canReplace(B)) {
        usedB = true;
        return { ...(B as GenealogyNode) };
      }
  
      return node;
    };
  
    const out = walk({ ...root });
    return (usedA && usedB) ? out : null;
  }

  // Replace any leaf with the same tribe as A or B by the actual A/B pal, if possible.
  // Avoid creating a pair where father.id === mother.id at any step.
  private injectABLeaves(root: GenealogyNode, A: PalInfo, B: PalInfo): GenealogyNode | null {
    let usedA = false, usedB = false;
    const clone = (n: GenealogyNode): GenealogyNode => ({ ...n });

    const walk = (node: GenealogyNode, parent?: GenealogyNode, isLeft?: boolean): GenealogyNode => {
      if (!node.parent1 && !node.parent2) {
        // leaf — consider swapping to A/B if tribe matches and still missing
        if (!usedA && node.tribeId === A.tribeId) {
          const swapped = { ...A };
          // prevent self‑breed with sibling
          const sib = parent && (isLeft ? parent.parent2 : parent.parent1);
          if (!sib || normalizeId(swapped.id) !== normalizeId(sib.id)) {
            usedA = true;
            return swapped as GenealogyNode;
          }
        }
        if (!usedB && node.tribeId === B.tribeId) {
          const swapped = { ...B };
          const sib = parent && (isLeft ? parent.parent2 : parent.parent1);
          if (!sib || normalizeId(swapped.id) !== normalizeId(sib.id)) {
            usedB = true;
            return swapped as GenealogyNode;
          }
        }
        return node;
      }
      // internal
      const out = clone(node);
      if (out.parent1) out.parent1 = walk(out.parent1, out, true);
      if (out.parent2) out.parent2 = walk(out.parent2, out, false);
      return out;
    };

    const out = walk(root);
    return (usedA && usedB) ? out : null;
  }

  // Turn the final tree into ordered steps (parents before child). Minimal logging.
  private linearize(finalNode: GenealogyNode): Step[] {
    const steps: Step[] = [];
    const emit = (n: GenealogyNode) => {
      if (!n.parent1 || !n.parent2) return;
      emit(n.parent1);
      emit(n.parent2);

      // assign father/mother respecting sex
      let father = n.parent1, mother = n.parent2;
      if (!isBreedablePair(father.sex, mother.sex) && isBreedablePair(mother.sex, father.sex)) {
        [father, mother] = [mother, father];
      }

      steps.push({
        father, mother,
        passives: n.passives ?? [],
        talents: n.talents ?? {},
        childTribeId: n.tribeId,
        childTribeName: palDatabase[n.tribeId].OverrideNameTextID,
        childCombiRank: 0,
        pSuccess: 1, expectedTime: 0,
      });
    };
    emit(finalNode);
    return steps;
  }

  private sumTalents(a: Talents) : number {
    return a.attack;
  }
}
