import { describe,expect,it } from "vitest";
import { marketEvidenceGrade,recommendationFor,scoreObservation } from "../lib/scoring";
import { ferrari } from "./fixtures";
describe("separate decision gates",()=>{it("does not mix condition into priority",()=>{const poor={...ferrari,condition:{...ferrari.condition,grade:"poor" as const}};expect(scoreObservation(poor).total).toBe(scoreObservation(ferrari).total);expect(recommendationFor(poor,scoreObservation(poor).total).conditionGate.status).toBe("fail")});it("grades evidence independently",()=>expect(marketEvidenceGrade(ferrari)).toBe("A"));});
