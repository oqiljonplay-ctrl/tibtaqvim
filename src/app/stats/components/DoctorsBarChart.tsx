"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface Props {
  data: BreakdownItem[];
}

export default function DoctorsBarChart({ data }: Props) {
  const chartHeight = Math.max(240, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f3f4f6"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#374151" }}
          width={110}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`${value} ta`, "Bronlar"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color ?? "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
