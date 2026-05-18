"use client";
import { HiOutlineSparkles, HiOutlineLightBulb } from "react-icons/hi";
import { FiSearch, FiCpu, FiTruck, FiSmile, FiHeart, FiShoppingCart, FiUser, FiActivity, FiZap, FiUsers } from "react-icons/fi";

export function AgentIcon({ name }: { name: string }) {
  // Core agents
  if (name === "Orchestrator")    return <HiOutlineLightBulb size={10} />;
  if (name === "Research Agent")  return <FiSearch size={9} />;
  if (name === "Synthesizer")     return <HiOutlineSparkles size={10} />;

  // Domain agents
  if (name === "D1_Road_Accidents")       return <FiTruck size={9} />;
  if (name === "D2_Mental_Health")        return <FiSmile size={9} />;
  if (name === "D3_NCDs")                 return <FiHeart size={9} />;
  if (name === "D4_Nutrition")            return <FiShoppingCart size={9} />;
  if (name === "D5_Elderly_Care")         return <FiUser size={9} />;
  if (name === "D6_Communicable_Disease") return <FiActivity size={9} />;
  if (name === "D7_Cancer")               return <FiZap size={9} />;
  if (name === "D8_Population")           return <FiUsers size={9} />;

  return <FiCpu size={9} />;
}
