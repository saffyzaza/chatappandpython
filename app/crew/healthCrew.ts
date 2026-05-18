import type { Crew } from "@/app/agents/types";
import { orchestrator, researchAgent, synthesizer } from "@/app/agents";
import analyzeQuery from "@/app/tasks/analyzeQuery";
import researchData from "@/app/tasks/researchData";
import writeAnswer from "@/app/tasks/writeAnswer";

const healthCrew: Crew = {
  name: "Health Information Crew",
  agents: [orchestrator, researchAgent, synthesizer],
  tasks: [analyzeQuery, researchData, writeAnswer],
  process: "sequential",
  verbose: true,
};

export default healthCrew;
