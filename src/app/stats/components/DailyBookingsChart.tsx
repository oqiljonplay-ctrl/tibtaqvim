"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyPoint {
  date: string;
  label: string;
  count: number;
}

interface Props {
  data: DailyPoint[];
}

export default function DailyBookingsChart({ data }: Props) {
  const tickInterval =
    data.length > 30 ? Math.floor(data.length / 7) : "preserveStartEnd";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          interval={tickInterval as number | "preserveStartEnd"}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value) => [`${value} ta`, "Bronlar"]}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#3b82f6" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
