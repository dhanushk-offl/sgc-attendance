"use client"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { ArrowLeft, MessageSquareText, Search, Trash2, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { supabase } from "@/lib/supabase"

interface Feedback {
  id: number
  created_at: string
  name: string
  email: string
  feedback_type: string
  message: string
  status: string
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
}

const statusOptions = ["pending", "in-progress", "resolved", "rejected"]

export default function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<Feedback | null>(null)
  const router = useRouter()

  useEffect(() => {
    void checkSession()
  }, [])

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
      await fetchFeedbacks()
    } catch (error) {
      console.error("Error checking session:", error)
      router.replace("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching feedback:", error)
      return
    }

    setFeedbacks(data || [])
  }

  const updateFeedbackStatus = async (id: number, newStatus: string) => {
    const { error } = await supabase.from("feedback").update({ status: newStatus }).eq("id", id)

    if (error) {
      console.error("Error updating feedback status:", error)
      alert("Failed to update status. Please try again.")
      return
    }

    setFeedbacks((current) =>
      current.map((feedback) => (feedback.id === id ? { ...feedback, status: newStatus } : feedback)),
    )
  }

  const deleteFeedback = async (id: number) => {
    const { error } = await supabase.from("feedback").delete().eq("id", id)

    if (error) {
      console.error("Error deleting feedback:", error)
      alert("Failed to delete feedback. Please try again.")
      return
    }

    setDeleteConfirm(null)
    setFeedbacks((current) => current.filter((feedback) => feedback.id !== id))
  }

  const filteredFeedbacks = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return feedbacks.filter((feedback) => {
      return (
        feedback.name.toLowerCase().includes(query) ||
        feedback.email.toLowerCase().includes(query) ||
        feedback.feedback_type.toLowerCase().includes(query) ||
        feedback.message.toLowerCase().includes(query) ||
        feedback.status.toLowerCase().includes(query)
      )
    })
  }, [feedbacks, searchQuery])

  const feedbackSummary = useMemo(() => {
    return {
      total: filteredFeedbacks.length,
      pending: filteredFeedbacks.filter((feedback) => feedback.status === "pending").length,
      resolved: filteredFeedbacks.filter((feedback) => feedback.status === "resolved").length,
    }
  }, [filteredFeedbacks])

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f0f0]">
        <div className="rounded-md border-2 border-black bg-white p-6 text-xl font-semibold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] p-3 md:p-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin/dashboard"
          className="group mb-6 inline-flex items-center gap-2 text-gray-700 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>

        <div className="mb-6 flex flex-col gap-4 rounded-lg border-2 border-black bg-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Logo" width={80} height={80} className="hidden sm:block" />
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-4xl">Feedback Management</h1>
              <p className="text-sm text-gray-600">Review submissions, update status, and clean up resolved items.</p>
            </div>
          </div>
          <div className="rounded-md border-2 border-black bg-yellow-100 px-4 py-3 text-sm font-medium">
            {filteredFeedbacks.length} visible feedback entr{filteredFeedbacks.length === 1 ? "y" : "ies"}
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border-2 border-black bg-blue-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Total</p>
            <p className="text-3xl font-black">{feedbackSummary.total}</p>
          </div>
          <div className="rounded-lg border-2 border-black bg-yellow-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Pending</p>
            <p className="text-3xl font-black">{feedbackSummary.pending}</p>
          </div>
          <div className="rounded-lg border-2 border-black bg-green-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Resolved</p>
            <p className="text-3xl font-black">{feedbackSummary.resolved}</p>
          </div>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, type, message, or status..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-md border-2 border-black bg-white py-3 pl-12 pr-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
          />
        </div>

        {filteredFeedbacks.length === 0 ? (
          <div className="rounded-lg border-2 border-black bg-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <MessageSquareText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="text-lg font-bold">No feedback found</p>
            <p className="text-sm text-gray-600">Try a different search or wait for new submissions.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="rounded-lg border-2 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">{feedback.name}</h2>
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-bold uppercase ${
                          statusColors[feedback.status] || "bg-gray-100 text-gray-800 border-gray-300"
                        }`}
                      >
                        {feedback.status}
                      </span>
                      <span className="rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-medium">
                        {feedback.feedback_type}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-gray-600">{feedback.email}</p>
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      {formatDate(feedback.created_at)} at {formatTime(feedback.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={feedback.status}
                      onChange={(event) => updateFeedbackStatus(feedback.id, event.target.value)}
                      className={`rounded-md border-2 px-3 py-2 text-sm font-bold ${
                        statusColors[feedback.status] || "bg-gray-100 text-gray-800 border-gray-300"
                      }`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDeleteConfirm(feedback)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-black bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="rounded-md border-2 border-black bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Message</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">{feedback.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-start justify-between border-b-2 border-black bg-red-100 p-4">
                <div>
                  <h3 className="text-xl font-black text-red-700">Delete Feedback</h3>
                  <p className="text-sm text-gray-700">{deleteConfirm.name}</p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-md border-2 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">
                <p className="mb-2 text-gray-700">Are you sure you want to delete this feedback entry?</p>
                <p className="text-sm font-medium text-red-600">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-3 border-t-2 border-black p-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-md border-2 border-black bg-gray-100 px-4 py-2 font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteFeedback(deleteConfirm.id)}
                  className="rounded-md border-2 border-black bg-red-500 px-4 py-2 font-bold text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
