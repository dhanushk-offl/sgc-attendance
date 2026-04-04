"use client"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { ArrowLeft, Search, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import AttendanceBarChart from "@/components/BarChart"
import { supabase } from "@/lib/supabase"

interface AttendanceMonth {
  month_key: string
  display_month: string
  total_working_days: number
}

interface MonthlyAttendance {
  member_id: number
  member_name: string
  department: string
  role: string
  total_working_days: number
  present_days: number
  absent_dates: string[]
  percentage: number
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [availableMonths, setAvailableMonths] = useState<AttendanceMonth[]>([])
  const [selectedMonth, setSelectedMonth] = useState("")
  const [monthlyReport, setMonthlyReport] = useState<MonthlyAttendance[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [absentDateDialog, setAbsentDateDialog] = useState<{ memberName: string; dates: string[] } | null>(null)
  const router = useRouter()

  useEffect(() => {
    void checkSession()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      void fetchMonthlyReport(selectedMonth)
    } else {
      setMonthlyReport([])
    }
  }, [selectedMonth])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, searchQuery, rowsPerPage])

  const checkSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/admin/login")
        return
      }

      setUser(session.user)
      await fetchAvailableMonths()
    } catch (error) {
      console.error("Error checking session:", error)
      router.replace("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableMonths = async () => {
    const { data, error } = await supabase.rpc("get_attendance_months")

    if (error) {
      console.error("Error fetching attendance months:", error)
      return
    }

    const months = ((data || []) as AttendanceMonth[]).sort((a, b) => b.month_key.localeCompare(a.month_key))
    setAvailableMonths(months)
    setSelectedMonth((currentMonth) => {
      if (currentMonth && months.some((month) => month.month_key === currentMonth)) {
        return currentMonth
      }

      return months[0]?.month_key || ""
    })
  }

  const fetchMonthlyReport = async (monthKey: string) => {
    setReportLoading(true)
    const { data, error } = await supabase.rpc("get_monthly_attendance_report", {
      p_month_key: monthKey,
    })

    if (error) {
      console.error("Error fetching monthly attendance report:", error)
      setMonthlyReport([])
      setReportLoading(false)
      return
    }

    setMonthlyReport((data || []) as MonthlyAttendance[])
    setReportLoading(false)
  }

  const filteredReport = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return monthlyReport
      .filter((record) => {
        return (
          record.member_name.toLowerCase().includes(query) ||
          record.department.toLowerCase().includes(query) ||
          record.role.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => a.member_name.localeCompare(b.member_name))
  }, [monthlyReport, searchQuery])

  const chartData = useMemo(() => {
    return filteredReport
      .filter((record) => record.total_working_days > 0)
      .sort((a, b) => {
        if (a.percentage !== b.percentage) {
          return a.percentage - b.percentage
        }

        return a.member_name.localeCompare(b.member_name)
      })
      .slice(0, 20)
      .map((record) => ({
        name: record.member_name,
        present: record.present_days,
        absent: record.total_working_days - record.present_days,
      }))
  }, [filteredReport])

  const totalPages = Math.max(1, Math.ceil(filteredReport.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * rowsPerPage
  const paginatedReport = filteredReport.slice(startIndex, startIndex + rowsPerPage)
  const visibleSummary = {
    totalMembers: filteredReport.length,
    belowThreshold: filteredReport.filter((record) => record.total_working_days > 0 && record.percentage < 75).length,
    noWorkingDays: filteredReport.filter((record) => record.total_working_days === 0).length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f0f0]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-xl font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] p-2 sm:p-4 md:p-8">
      <Link href="/admin/dashboard" className="group mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 sm:mb-6">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span className="text-sm font-medium">Back to Dashboard</span>
      </Link>

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Image src="/logo.png" alt="SGC Logo" width={100} height={100} />
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">Monthly Attendance Reports</h1>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto sm:px-4"
          >
            {availableMonths.map((month) => (
              <option key={month.month_key} value={month.month_key}>
                {month.display_month} ({month.total_working_days})
              </option>
            ))}
          </select>
        </div>

        {chartData.length > 0 && (
          <div className="mb-6 hidden rounded-lg border-2 border-black bg-white p-3 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:block sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold sm:text-xl md:text-2xl">Attendance Overview</h2>
                <p className="text-sm text-gray-600">Showing the 20 lowest attendance records for quick review.</p>
              </div>
              <div className="rounded-md border-2 border-black bg-yellow-100 px-3 py-2 text-sm font-medium">
                {filteredReport.length} member{filteredReport.length === 1 ? "" : "s"} in current filter
              </div>
            </div>
            <div className="h-[420px]">
              <AttendanceBarChart data={chartData} />
            </div>
          </div>
        )}

        <div className="rounded-lg border-2 border-black bg-white p-3 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-6">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-bold sm:text-xl md:text-2xl">
              Monthly Attendance Record - {availableMonths.find((month) => month.month_key === selectedMonth)?.display_month || "No month selected"}
            </h2>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 pl-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border-2 border-black bg-blue-100 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Visible Members</p>
              <p className="text-2xl font-black">{visibleSummary.totalMembers}</p>
            </div>
            <div className="rounded-md border-2 border-black bg-red-100 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Below 75%</p>
              <p className="text-2xl font-black">{visibleSummary.belowThreshold}</p>
            </div>
            <div className="rounded-md border-2 border-black bg-gray-100 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700">No Working Days</p>
              <p className="text-2xl font-black">{visibleSummary.noWorkingDays}</p>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredReport.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredReport.length)} of {filteredReport.length} members
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="rows-per-page" className="text-sm font-medium text-gray-700">
                Rows per page
              </label>
              <select
                id="rows-per-page"
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="rounded-md border-2 border-black bg-white px-3 py-2 text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="-mx-3 overflow-x-auto sm:-mx-6">
            <div className="inline-block min-w-full align-middle">
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full divide-y-2 divide-black">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Name</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Department</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Role</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Working Days</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Present</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Absent</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Attendance %</th>
                      <th className="px-2 py-3 text-left text-xs font-black sm:px-4 sm:text-sm">Absent Dates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black bg-white">
                    {reportLoading ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-8 text-center text-sm text-gray-500 sm:px-4">
                          Loading report...
                        </td>
                      </tr>
                    ) : paginatedReport.map((data) => (
                      <tr key={data.member_id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-2 py-3 text-xs font-medium sm:px-4 sm:text-sm">{data.member_name}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">{data.department}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">{data.role}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">{data.total_working_days}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">{data.present_days}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">{data.total_working_days - data.present_days}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs sm:px-4 sm:text-sm">
                          <span
                            className={`rounded-md border-2 border-black px-2 py-1 font-medium ${
                              data.total_working_days === 0
                                ? "bg-gray-100 text-gray-600"
                                : data.percentage < 75
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {data.total_working_days === 0 ? "No Working Days" : `${data.percentage.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs transition-all duration-200 sm:px-4 sm:text-sm">
                          {data.total_working_days === 0 ? (
                            <span className="italic text-gray-500">No working days recorded</span>
                          ) : data.absent_dates.length === 0 ? (
                            <span className="font-medium text-green-600">No absences</span>
                          ) : (
                            <button
                              onClick={() => setAbsentDateDialog({ memberName: data.member_name, dates: data.absent_dates })}
                              className="rounded-md border-2 border-black bg-blue-100 px-3 py-1 font-medium text-blue-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              View {data.absent_dates.length} {data.absent_dates.length === 1 ? "date" : "dates"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!reportLoading && paginatedReport.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-2 py-8 text-center text-sm text-gray-500 sm:px-4">
                          {searchQuery ? "No matching records found" : "No attendance records found for this month"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {filteredReport.length > rowsPerPage && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">Page {safeCurrentPage} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {absentDateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-start justify-between border-b-2 border-black bg-yellow-100 p-4">
              <div>
                <h2 className="text-xl font-black">Absent Dates</h2>
                <p className="text-sm text-gray-700">{absentDateDialog.memberName}</p>
              </div>
              <button
                onClick={() => setAbsentDateDialog(null)}
                className="rounded-md border-2 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {absentDateDialog.dates.map((date) => (
                  <div
                    key={`${absentDateDialog.memberName}-${date}`}
                    className="rounded-md border-2 border-black bg-gray-50 px-3 py-2 text-sm font-medium"
                  >
                    {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t-2 border-black p-4">
              <button
                onClick={() => setAbsentDateDialog(null)}
                className="w-full rounded-md border-2 border-black bg-blue-500 px-4 py-2 font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
