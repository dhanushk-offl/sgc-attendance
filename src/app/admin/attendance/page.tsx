"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { ArrowLeft, Check, RefreshCw, Share2, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

type Member = {
  id: number
  name: string
  department: string
  role: string
  academicYear: string
}

type GroupedMembers = Record<string, Member[]>
type AttendanceMap = Record<number, boolean | undefined>

export default function DailyAttendance() {
  const [members, setMembers] = useState<Member[]>([])
  const [groupedMembers, setGroupedMembers] = useState<GroupedMembers>({})
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [attendance, setAttendance] = useState<AttendanceMap>({})
  const [originalAttendance, setOriginalAttendance] = useState<AttendanceMap>({})
  const [changedAttendance, setChangedAttendance] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState("")
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingAttendance, setFetchingAttendance] = useState(false)
  const [submittingAttendance, setSubmittingAttendance] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const router = useRouter()

  const yearOrder: Record<string, number> = {
    IV: 1,
    III: 2,
    II: 3,
    I: 4,
  }

  useEffect(() => {
    void checkSession()
  }, [])

  useEffect(() => {
    void fetchMembers()
  }, [])

  useEffect(() => {
    if (members.length > 0) {
      void fetchAttendance()
    }
  }, [date, members])

  useEffect(() => {
    const grouped = members.reduce((acc: GroupedMembers, member) => {
      const year = member.academicYear || "Other"
      if (!acc[year]) {
        acc[year] = []
      }
      acc[year].push(member)
      return acc
    }, {})

    Object.keys(grouped).forEach((year) => {
      grouped[year].sort((a, b) => a.name.localeCompare(b.name))
    })

    setGroupedMembers(grouped)
  }, [members])

  useEffect(() => {
    if (!showToast) {
      return
    }

    const timer = window.setTimeout(() => {
      setShowToast(false)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [showToast])

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
    } catch (error) {
      console.error("Error checking session:", error)
      router.replace("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("id, name, department, role, academicYear")
      .order("academicYear", { ascending: false })

    if (error) {
      console.error("Error fetching members:", error)
      return
    }

    setMembers(data || [])
  }

  const fetchAttendance = async () => {
    setFetchingAttendance(true)

    const { data, error } = await supabase.from("attendance").select("member_id, is_present").eq("date", date)

    if (error) {
      console.error("Error fetching attendance:", error)
      setFetchingAttendance(false)
      return
    }

    const fetchedAttendance = (data || []).reduce((acc: AttendanceMap, record: { member_id: number; is_present: boolean }) => {
      acc[record.member_id] = record.is_present
      return acc
    }, {})

    setAttendance(fetchedAttendance)
    setOriginalAttendance(fetchedAttendance)
    setChangedAttendance(new Set())
    setMessage("")
    setFetchingAttendance(false)
  }

  const updateAttendanceState = (nextAttendance: AttendanceMap) => {
    const nextChanged = new Set<number>()

    members.forEach((member) => {
      if (originalAttendance[member.id] !== nextAttendance[member.id]) {
        nextChanged.add(member.id)
      }
    })

    setAttendance(nextAttendance)
    setChangedAttendance(nextChanged)
  }

  const handleAttendanceChange = (memberId: number, isPresent: boolean) => {
    updateAttendanceState({
      ...attendance,
      [memberId]: isPresent,
    })
  }

  const clearMemberSelection = (memberId: number) => {
    const nextAttendance = { ...attendance }
    delete nextAttendance[memberId]
    updateAttendanceState(nextAttendance)
  }

  const setAllMembers = (isPresent: boolean) => {
    const nextAttendance = members.reduce((acc: AttendanceMap, member) => {
      acc[member.id] = isPresent
      return acc
    }, {})

    updateAttendanceState(nextAttendance)
  }

  const resetSelections = () => {
    updateAttendanceState({ ...originalAttendance })
  }

  const generateMessage = () => {
    const presentMembers = members.filter((member) => attendance[member.id] === true)
    const absentMembers = members.filter((member) => attendance[member.id] !== true)

    const formattedMessage = `*Attendance Report - ${date}*\n\n*Present (${presentMembers.length}):*\n${presentMembers.map((member) => `- ${member.name} (${member.academicYear} Year)`).join("\n") || "None"}\n\n*Absent (${absentMembers.length}):*\n${absentMembers.map((member) => `- ${member.name} (${member.academicYear} Year)`).join("\n") || "None"}\n\n*Stay consistent and keep learning!*`
    setMessage(formattedMessage)
  }

  const submitAttendance = async () => {
    if (changedAttendance.size === 0) {
      setToastMessage("No changes to submit")
      setShowToast(true)
      return
    }

    const presentMemberIds = members.filter((member) => attendance[member.id] === true).map((member) => member.id)
    const hasExplicitAbsences = members.some((member) => attendance[member.id] === false)
    const fallbackAbsentMemberId =
      members.find((member) => attendance[member.id] === false)?.id ?? members[0]?.id ?? null

    setSubmittingAttendance(true)
    const { error } = await supabase.rpc("record_attendance_for_date", {
      p_date: date,
      p_present_member_ids: presentMemberIds,
      p_mark_working_day: presentMemberIds.length > 0 || hasExplicitAbsences,
      p_absent_member_id: fallbackAbsentMemberId,
    })
    setSubmittingAttendance(false)

    if (error) {
      console.error("Error submitting attendance:", error)
      setToastMessage("Error updating attendance")
      setShowToast(true)
      return
    }

    const nextOriginalAttendance = members.reduce((acc: AttendanceMap, member) => {
      const value = attendance[member.id]
      if (value !== undefined) {
        acc[member.id] = value
      }
      return acc
    }, {})

    setOriginalAttendance(nextOriginalAttendance)
    setChangedAttendance(new Set())
    setToastMessage(`Attendance saved for ${date}`)
    setShowToast(true)
    generateMessage()
  }

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    setMessage("")
  }

  const presentCount = members.filter((member) => attendance[member.id] === true).length
  const explicitAbsentCount = members.filter((member) => attendance[member.id] === false).length
  const inferredAbsentCount = members.length - presentCount
  const workingDayWillBeRecorded = presentCount > 0 || explicitAbsentCount > 0

  const renderYearCard = (year: string, yearMembers: Member[]) => (
    <Card
      key={year}
      className="mb-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="rounded-t-md border-b-2 border-black bg-yellow-100 p-4">
        <h3 className="text-xl font-bold">{year} Year Students</h3>
        <p className="mt-1 text-sm text-gray-600">{yearMembers.length} members</p>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="border-b-2 border-black px-4 py-3 text-left font-bold">Name</th>
                <th className="w-[220px] border-b-2 border-black px-4 py-3 text-center font-bold">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {yearMembers.map((member, index) => {
                const hasChanged = changedAttendance.has(member.id)

                return (
                  <tr
                    key={member.id}
                    className={`hover:bg-gray-50 ${index !== yearMembers.length - 1 ? "border-b border-gray-200" : ""} ${hasChanged ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium">
                        {member.name}
                        {hasChanged && <span className="text-xs font-bold text-blue-600">Changed</span>}
                      </p>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleAttendanceChange(member.id, true)}
                          className={`flex h-10 w-10 items-center justify-center rounded-md border-2 border-black transition-all ${
                            attendance[member.id] === true
                              ? "bg-green-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-gray-100 hover:bg-green-100"
                          }`}
                          aria-label={`Mark ${member.name} present`}
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(member.id, false)}
                          className={`flex h-10 w-10 items-center justify-center rounded-md border-2 border-black transition-all ${
                            attendance[member.id] === false
                              ? "bg-red-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-gray-100 hover:bg-red-100"
                          }`}
                          aria-label={`Mark ${member.name} absent`}
                        >
                          <X className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => clearMemberSelection(member.id)}
                          className={`h-10 rounded-md border-2 border-black px-3 text-xs font-bold transition-all ${
                            attendance[member.id] === undefined
                              ? "bg-blue-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-gray-100 hover:bg-blue-50"
                          }`}
                          aria-label={`Clear ${member.name} selection`}
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] p-4 md:p-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-xl font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] p-4 md:p-8">
      {showToast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 transform">
          <div className="flex items-center justify-between rounded-md bg-green-500 px-4 py-2 text-white shadow-md">
            <span>{toastMessage}</span>
            <button onClick={() => setShowToast(false)} className="ml-2 text-white hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Link href="/admin/dashboard" className="group mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span className="text-sm font-medium">Back to Dashboard</span>
      </Link>

      <div className="mb-6 flex items-center justify-center">
        <Image src="/logo.png" alt="SGC Logo" width={100} height={100} />
      </div>

      <div className="mx-auto max-w-4xl">
        <Card className="mb-6 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="p-4 md:p-6">
            <h1 className="mb-6 text-3xl font-black tracking-tight md:text-4xl">Daily Attendance</h1>

            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(event) => handleDateChange(event.target.value)}
                className="flex-1 rounded-md border-2 border-black px-4 py-3 text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
              <button
                onClick={() => void fetchAttendance()}
                disabled={fetchingAttendance}
                className="flex items-center gap-2 rounded-md border-2 border-black bg-orange-400 px-4 py-3 font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 ${fetchingAttendance ? "animate-spin" : ""}`} />
                {fetchingAttendance ? "Loading..." : "Fetch"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setAllMembers(true)}
                className="rounded-md border-2 border-black bg-green-200 px-4 py-2 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Mark All Present
              </button>
              <button
                onClick={() => setAllMembers(false)}
                className="rounded-md border-2 border-black bg-red-200 px-4 py-2 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Mark All Absent
              </button>
              <button
                onClick={resetSelections}
                className="rounded-md border-2 border-black bg-white px-4 py-2 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Reset to Saved
              </button>
            </div>

            {changedAttendance.size > 0 && (
              <div className="mt-4 rounded-md border-2 border-blue-500 bg-blue-100 p-3">
                <p className="text-sm font-medium text-blue-900">{changedAttendance.size} unsaved change(s)</p>
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border-2 border-black bg-green-100 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Present</p>
                <p className="text-2xl font-black">{presentCount}</p>
              </div>
              <div className="rounded-md border-2 border-black bg-red-100 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Absent</p>
                <p className="text-2xl font-black">{inferredAbsentCount}</p>
                <p className="text-xs text-gray-600">{explicitAbsentCount} explicitly marked</p>
              </div>
              <div className="rounded-md border-2 border-black bg-yellow-100 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Working Day</p>
                <p className="text-sm font-bold">
                  {workingDayWillBeRecorded ? "Yes, this date will count" : "No, date stays unsaved"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-700">
              Only present members are stored for normal days. Anyone not marked present on a saved working day is
              treated as absent automatically.
            </p>
          </div>
        </Card>

        {fetchingAttendance ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMembers)
              .sort(([yearA], [yearB]) => (yearOrder[yearA] || 999) - (yearOrder[yearB] || 999))
              .map(([year, yearMembers]) => renderYearCard(year, yearMembers))}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <button
            onClick={submitAttendance}
            disabled={changedAttendance.size === 0 || submittingAttendance}
            className="w-full rounded-md border-2 border-black bg-blue-500 px-6 py-4 font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submittingAttendance
              ? "Saving..."
              : changedAttendance.size > 0
                ? `Save ${changedAttendance.size} Change(s)`
                : "No Changes to Submit"}
          </button>

          {message && (
            <Card className="border-2 border-black bg-green-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="p-4 md:p-6">
                <h2 className="mb-4 text-lg font-bold md:text-xl">Attendance Summary</h2>
                <pre className="whitespace-pre-wrap text-sm font-medium md:text-base">{message}</pre>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-black bg-green-500 px-4 py-3 font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:px-6"
                >
                  <Share2 className="h-5 w-5" />
                  Share on WhatsApp
                </a>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
