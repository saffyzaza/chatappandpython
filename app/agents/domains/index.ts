import d0GeneralAdvisor from "./d0GeneralAdvisor";
import d1RoadAccidents from "./d1RoadAccidents";
import d2MentalHealth from "./d2MentalHealth";
import d3NCDs from "./d3NCDs";
import d4Nutrition from "./d4Nutrition";
import d5ElderlyCare from "./d5ElderlyCare";
import d6CommunicableDisease from "./d6CommunicableDisease";
import d7Cancer from "./d7Cancer";
import d8Population from "./d8Population";
import type { Agent } from "../types";

export const DOMAIN_AGENTS: Record<string, Agent> = {
  D0_General_Advisor:      d0GeneralAdvisor,
  D1_Road_Accidents:       d1RoadAccidents,
  D2_Mental_Health:        d2MentalHealth,
  D3_NCDs:                 d3NCDs,
  D4_Nutrition:            d4Nutrition,
  D5_Elderly_Care:         d5ElderlyCare,
  D6_Communicable_Disease: d6CommunicableDisease,
  D7_Cancer:               d7Cancer,
  D8_Population:           d8Population,
};

export const DOMAIN_LIST = Object.keys(DOMAIN_AGENTS).join(" | ");

export {
  d0GeneralAdvisor,
  d1RoadAccidents, d2MentalHealth, d3NCDs, d4Nutrition,
  d5ElderlyCare, d6CommunicableDisease, d7Cancer, d8Population,
};
