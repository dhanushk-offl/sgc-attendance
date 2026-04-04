"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface AttendanceData {
  name: string
  present: number
  absent: number
}

interface BarChartProps {
  data: AttendanceData[]
}

const truncateName = (value: string) => {
  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 18)}...`
}

export default function AttendanceBarChart({ data }: BarChartProps) {
  const chartHeight = Math.max(data.length * 38, 320)

  return (
    <div className="h-[420px] w-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
      <div style={{ height: chartHeight, minWidth: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 20,
              right: 24,
              left: 24,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="name" type="category" width={150} tickFormatter={truncateName} />
            <Tooltip />
            <Legend />
            <Bar dataKey="present" fill="#4ade80" name="Present" radius={[0, 4, 4, 0]} />
            <Bar dataKey="absent" fill="#f87171" name="Absent" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
