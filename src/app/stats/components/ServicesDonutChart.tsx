"use client";
import DonutChart from "./DonutChart";

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface Props {
  data: BreakdownItem[];
}

export default function ServicesDonutChart({ data }: Props) {
  return <DonutChart data={data} />;
}
