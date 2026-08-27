import { describe,expect,it } from "vitest";
import { evaluateIrishPrice,inferPriceCategory } from "../lib/pricing";
describe("Ireland price gate",()=>{it("recognizes premium retail",()=>expect(evaluateIrishPrice("premium_single",9.99).verdict).toBe("fair"));it("flags a strong sale",()=>expect(evaluateIrishPrice("premium_2_pack",14.99).verdict).toBe("strong_buy"));it("flags overpricing",()=>expect(evaluateIrishPrice("team_transport",30).verdict).toBe("overpriced"));it("maps lines",()=>expect(inferPriceCategory("Car Culture")).toBe("premium_single"));});
