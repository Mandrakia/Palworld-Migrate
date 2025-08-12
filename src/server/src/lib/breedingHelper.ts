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
export function getBreedingResult(parent1Char: string, parent2Char: string): string {
  return getReverseCombinationsMap().get([parent1Char, parent2Char].sort().join('x'))!;
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
type Candidate = {
  node: GenealogyNode;
  stepsCount: number; // count of emitted steps if linearized
  mask: ABMask;       // whether it includes A and/or B
};

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
  parent1?: PalInfo
  parent2?: PalInfo
  pSuccess?: number
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
  private tribeIdByRank: Map<number, string>
  private options: BreedingOptions
  private reverseCombinations: Map<string, string>

  constructor(speciesDb: Tribe[], options?: Partial<BreedingOptions>) {
    this.speciesById = new Map(speciesDb.map(t => [t.tribeId, t]))
    this.tribeIdByRank = new Map(speciesDb.map(t => [t.combiRank, t.tribeId]))
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

// Returns the probability (0..1) of getting the "best" passive combination.
// Definitions:
// - combinedPool = distinct union of poolA and poolB
// - You roll number of passives K with P(K=1)=0.4, P(K=2)=0.3, P(K=3)=0.2, P(K=4)=0.1
// - After K is rolled, a size-K subset is drawn uniformly at random (without replacement)
// - "Best" for a given K means: maximize the count of desired passives (by priority).
//   * If there are at least K desired in the combined pool: the single best set is the top-K desired.
//   * If there are fewer than K desired: any set that contains ALL desired plus any fillers is equally best.
private pPassives(
  poolA: string[],
  poolB: string[]
): { pResult: number; passives: string[] } {
  // Distinct union
  const combinedSet = new Set<string>([...poolA, ...poolB]);
  const combinedPool = Array.from(combinedSet);
  const N = combinedPool.length;

  // Desired in priority order (insertion order of the Set)
  const desiredOrdered = Array.from(this.options.desiredSet ?? []);
  const desiredInPool = desiredOrdered.filter(d => combinedSet.has(d));
  const D = desiredInPool.length;
  const U = N - D;

  // Best passives output (your simplified rule)
  const passives = desiredInPool.slice(0, 4);

  // nCk
  const C = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let num = 1, den = 1;
    for (let i = 1; i <= k; i++) {
      num *= (n - (k - i));
      den *= i;
    }
    return num / den;
  };

  // P(K)
  const weights: Record<number, number> = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };

  // Probability that the drawn set is "best" for its K:
  // - If D >= K: unique best is the top-K desired → favorable = 1
  // - If D <  K: best = any set that contains ALL D desired → favorable = C(U, K - D)
  let pResult = 0;
  for (let K = 1; K <= 4; K++) {
    const w = weights[K];
    if (!w) continue;

    if (N === 0) { pResult += 0; continue; }
    if (K >= N) { pResult += w * 1; continue; } // picking all passives is necessarily best

    const totalComb = C(N, K);
    const favorable = (D >= K) ? 1 : C(U, K - D);
    pResult += w * (favorable / totalComb);
  }

  return { pResult, passives };
}




  private meetsTalents(t: Talents, thr: MinTalents): boolean {
    return t.hp>=thr.hp && t.attack>=thr.attack && t.defense>=thr.defense
  }

  private makeChildNode(
    father: PalInfo,
    mother: PalInfo,
    childTribeId: string
  ): GenealogyNode {
    const id = `${childTribeId}_${Math.random().toString(36).slice(2, 9)}`;
    const { pResult, passives } = this.pPassives(father.passives, mother.passives);

    return {
      id,
      tribeId: childTribeId,
      sex: 'Neutral', // Hypothetical children are always neutral
      talents: [father.talents, mother.talents].sort(this.options.talentsComparator)[0],
      name: this.speciesById.get(childTribeId)?.name || '',
      tribeName: this.speciesById.get(childTribeId)?.name || '',
      level: 1,
      passives,
      parent1: father,
      parent2: mother,
      pSuccess: pResult,
    }
  }

  private getBreedingResult(parent1TribeId: string, parent2TribeId: string): string {
    return this.reverseCombinations.get([parent1TribeId, parent2TribeId].sort().join('x'))!
  }
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
    const pool : PalInfo[] = [...pals];
    const key = (child:GenealogyNode) => `${child.tribeId}_${child.passives.join('_')}_${child.pSuccess}`;
    const existing = new Set<string>();
    for(let p of pool){
      existing.add(key(p as GenealogyNode));
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
        pSuccess: n.pSuccess ?? 1, 
        expectedTime: 0,
      });
    };
    emit(finalNode);
    return steps;
  }
}
