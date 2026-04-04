"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"

import { supabase } from "@/lib/supabase"

interface MonthlyAttendance {
  month: string
  workingDays: number
  presentDays: number
  absentDays: number
  attendancePercentage: number
  absentDates: string[]
}

interface MemberData {
  id: number
  name: string
  department: string
  role: string
  monthlyAttendance: MonthlyAttendance[]
}

interface AttendanceSummaryRow {
  member_id: number
  member_name: string
  department: string
  role: string
  month_key: string | null
  display_month: string | null
  total_working_days: number | null
  present_days: number | null
  absent_dates: string[] | null
  percentage: number | null
}

export default function MemberView() {
  const [memberData, setMemberData] = useState<MemberData | null>(null)
  const [searchType, setSearchType] = useState<"email" | "mobile">("email")
  const [searchValue, setSearchValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const formatMonthDisplay = (dateStr: string) => {
    const [year, month] = dateStr.split("-")
    const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, 1)
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const formatAbsentDate = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const fetchMemberData = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMemberData(null)

    try {
      const { data, error: rpcError } = await supabase.rpc("find_member_attendance_by_identifier", {
        p_search_type: searchType,
        p_search_value: searchValue.trim(),
      })

      if (rpcError) {
        setError("Error fetching attendance data. Please try again later.")
        setLoading(false)
        return
      }

      const rows = (data || []) as AttendanceSummaryRow[]
      const firstRow = rows[0]

      if (!firstRow || !firstRow.member_id) {
        setError("Member not found. Please check your details and try again.")
        setLoading(false)
        return
      }

      const monthlyAttendance = rows
        .filter((row) => row.month_key)
        .map((row) => ({
          month: row.month_key as string,
          workingDays: row.total_working_days ?? 0,
          presentDays: row.present_days ?? 0,
          absentDays: (row.total_working_days ?? 0) - (row.present_days ?? 0),
          attendancePercentage: row.percentage ?? 0,
          absentDates: (row.absent_dates || []).map(formatAbsentDate),
        }))
        .sort((a, b) => b.month.localeCompare(a.month))

      setMemberData({
        id: firstRow.member_id,
        name: firstRow.member_name,
        department: firstRow.department,
        role: firstRow.role,
        monthlyAttendance,
      })
    } catch (fetchError) {
      console.error("Unexpected member lookup error:", fetchError)
      setError("An unexpected error occurred. Please try again later.")
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f0f0] p-2 sm:p-4 md:p-8">
      <div className="w-full max-w-2xl rounded-lg border-2 border-black bg-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-6">
        <div className="mb-4 flex justify-center">
          <Image src="/logo.png" alt="SGC Logo" width={150} height={150} className="object-contain" priority />
        </div>

        <h2 className="mb-6 text-center text-2xl font-black tracking-tight sm:text-3xl">
          Member Attendance Analytics & Status
        </h2>

        <form onSubmit={fetchMemberData} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSearchType("email")}
              className={`w-1/2 rounded-lg border-2 border-black px-4 py-2 text-center transition-transform hover:-translate-y-0.5 ${
                searchType === "email"
                  ? "bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              Search by Email
            </button>
            <button
              type="button"
              onClick={() => setSearchType("mobile")}
              className={`w-1/2 rounded-lg border-2 border-black px-4 py-2 text-center transition-transform hover:-translate-y-0.5 ${
                searchType === "mobile"
                  ? "bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              Search by Phone
            </button>
          </div>

          <input
            type={searchType === "email" ? "email" : "tel"}
            placeholder={searchType === "email" ? "Enter email address" : "Enter phone number"}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="w-full rounded-lg border-2 border-black bg-white px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border-2 border-black bg-black px-4 py-2 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : "View Attendance"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-100 p-3 text-center text-red-700">
            {error}
          </div>
        )}

        {memberData && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="mb-4 text-lg font-black sm:text-xl">Member Information</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y-2 divide-black">
                  <tr>
                    <td className="py-2 font-bold">Name:</td>
                    <td>{memberData.name}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold">Department:</td>
                    <td>{memberData.department}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold">Role:</td>
                    <td>{memberData.role}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {memberData.monthlyAttendance.length === 0 ? (
              <div className="rounded-lg border-2 border-black bg-yellow-100 p-4 font-medium shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                No attendance has been recorded for this member yet.
              </div>
            ) : (
              memberData.monthlyAttendance.map((month) => (
                <div
                  key={month.month}
                  className="rounded-lg border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <h3 className="mb-4 text-lg font-black sm:text-xl">{formatMonthDisplay(month.month)}</h3>
                  <table className="w-full text-sm">
                    <tbody className="divide-y-2 divide-black">
                      <tr>
                        <td className="py-2 font-bold">Working Days:</td>
                        <td>{month.workingDays}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Present Days:</td>
                        <td>{month.presentDays}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Absent Days:</td>
                        <td>{month.absentDays}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Attendance Percentage:</td>
                        <td>
                          <span
                            className={`inline-flex rounded-md border-2 border-black px-2 py-1 ${
                              month.attendancePercentage < 75
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {month.attendancePercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {month.absentDates.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 font-bold">Absence Dates:</h4>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {month.absentDates.map((date) => (
                          <div
                            key={`${month.month}-${date}`}
                            className="rounded-lg border-2 border-black bg-gray-100 p-2 text-center text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            {date}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {month.attendancePercentage < 75 && (
                    <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-100 p-4 font-medium text-red-700 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                      Attendance Alert: Attendance for {formatMonthDisplay(month.month)} is below 75%
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>This Site was Developed and Maintained by SGC</p>
          <p>&copy; {new Date().getFullYear()} Students Guidance Cell - CAHCET. All Rights Reserved</p>
        </div>
      </div>
    </div>
  )
}
