"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { ArrowLeft, Search, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface Member {
  id: number
  name: string
  department: string
  role: string
  email: string
  mobile: string
  academicYear: string
}

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  
  const emptyMember: Omit<Member, 'id'> = {
    name: "",
    department: "",
    role: "",
    email: "",
    mobile: "",
    academicYear: ""
  }
  
  const [newMember, setNewMember] = useState(emptyMember)

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/admin/login')
        return
      }

      setUser(session.user)
      fetchMembers()
    } catch (error) {
      console.error('Error checking session:', error)
      router.replace('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    const { data, error } = await supabase.from("members").select("*")
    if (error) console.error("Error fetching members:", error)
    else setMembers(data || [])
  }

  // Sort and filter members
  const sortedAndFilteredMembers = useMemo(() => {
    const yearOrder = { "IV": 1, "III": 2, "II": 3, "I": 4 }
    
    return members
      .filter(member => {
        const searchLower = searchQuery.toLowerCase()
        return (
          member.name.toLowerCase().includes(searchLower) ||
          member.department.toLowerCase().includes(searchLower) ||
          member.role.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower) ||
          member.mobile.includes(searchQuery)
        )
      })
      .sort((a, b) => {
        // First sort by academic year
        if (yearOrder[a.academicYear as keyof typeof yearOrder] !== yearOrder[b.academicYear as keyof typeof yearOrder]) {
          return yearOrder[a.academicYear as keyof typeof yearOrder] - yearOrder[b.academicYear as keyof typeof yearOrder]
        }
        // Then sort alphabetically by name within the same year
        return a.name.localeCompare(b.name)
      })
  }, [members, searchQuery])

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.from("members").insert([newMember])
    if (error) {
      console.error("Error adding member:", error)
      alert("Failed to add member. Please try again.")
    } else {
      fetchMembers()
      setNewMember(emptyMember)
      setShowAddModal(false)
    }
  }

  const confirmDeleteSelectedMembers = () => {
    if (selectedMembers.length === 0) return
    setShowDeleteDialog(true)
  }

  const deleteSelectedMembers = async () => {
    const { error: attendanceError } = await supabase
      .from("attendance")
      .delete()
      .in("member_id", selectedMembers)

    if (attendanceError) {
      console.error("Error deleting member attendance:", attendanceError)
      alert("Failed to delete member attendance data. Please try again.")
      return
    }

    const { error } = await supabase
      .from("members")
      .delete()
      .in("id", selectedMembers)
    
    if (error) {
      console.error("Error deleting members:", error)
      alert("Failed to delete members. Please try again.")
    } else {
      setSelectedMembers([])
      fetchMembers()
    }
    setShowDeleteDialog(false)
  }

  const toggleMemberSelection = (id: number) => {
    setSelectedMembers(prev => 
      prev.includes(id) 
        ? prev.filter(memberId => memberId !== id)
        : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedMembers.length === sortedAndFilteredMembers.length) {
      setSelectedMembers([])
    } else {
      setSelectedMembers(sortedAndFilteredMembers.map(member => member.id))
    }
  }

  const startEdit = (member: Member) => {
    setEditingMember(member)
    setShowEditModal(true)
  }

  const updateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingMember) {
      const { error } = await supabase
        .from("members")
        .update({ 
          academicYear: editingMember.academicYear,
          role: editingMember.role 
        })
        .eq("id", editingMember.id)

      if (error) {
        console.error("Error updating member:", error)
        alert("Failed to update member. Please try again.")
      } else {
        setShowEditModal(false)
        fetchMembers()
      }
    }
  }

  const academicYears = ["I", "II", "III", "IV"]
  const roles = ["Trainee", "Member", "Advisor", "Vice President", "President", "Session Incharge", "Administrator"]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f0f0]">
        <div className="text-xl font-medium">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link 
          href="/admin/dashboard" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <Image
            src="/logo.png"
            alt="SGC Logo"
            width={100}
            height={100}
          />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Member Management</h1>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {selectedMembers.length > 0 && (
              <button
                onClick={confirmDeleteSelectedMembers}
                className="text-sm sm:text-base bg-red-500 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Delete Selected ({selectedMembers.length})
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm sm:text-base bg-blue-500 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              Add New Member
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search members by name, department, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="bg-white rounded-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-black">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="p-2 sm:p-4">
                      <input
                        type="checkbox"
                        checked={selectedMembers.length === sortedAndFilteredMembers.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black">Name</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black hidden md:table-cell">Department</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black">Role</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black">Year</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black hidden lg:table-cell">Email</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black hidden sm:table-cell">Mobile</th>
                    <th scope="col" className="p-2 sm:p-4 text-left text-xs sm:text-sm font-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black bg-white">
                  {sortedAndFilteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="p-2 sm:p-4">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => toggleMemberSelection(member.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm">{member.name}</td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">{member.department}</td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm">{member.role}</td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm">Year {member.academicYear}</td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm hidden lg:table-cell">{member.email}</td>
                      <td className="p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">{member.mobile}</td>
                      <td className="p-2 sm:p-4">
                        <button
                          onClick={() => startEdit(member)}
                          className="text-xs sm:text-sm bg-blue-500 text-white font-bold px-2 py-1 sm:px-4 sm:py-2 rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 w-full max-w-md">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-red-600">Confirm Deletion</h2>
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete <strong>{selectedMembers.length}</strong> selected member{selectedMembers.length > 1 ? 's' : ''}?
                </p>
                <p className="mb-2 text-sm font-medium text-red-700">
                  When you delete a member, that member&apos;s attendance data will be deleted as well.
                </p>
                <p className="text-sm text-red-600 font-medium">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="px-6 py-2 bg-gray-100 font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteSelectedMembers}
                  className="px-6 py-2 bg-red-500 text-white font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 sm:p-6 w-full max-w-2xl my-4">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Add New Member</h2>
              <form onSubmit={addMember} className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Name</label>
                    <input
                      type="text"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Department</label>
                    <input
                      type="text"
                      value={newMember.department}
                      onChange={(e) => setNewMember({ ...newMember, department: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Role</label>
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Academic Year</label>
                    <select
                      value={newMember.academicYear}
                      onChange={(e) => setNewMember({ ...newMember, academicYear: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    >
                      <option value="">Select Year</option>
                      {academicYears.map(year => (
                        <option key={year} value={year}>Year {year}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Email</label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 sm:mb-2">Mobile Number</label>
                    <input
                      type="tel"
                      value={newMember.mobile}
                      onChange={(e) => setNewMember({ ...newMember, mobile: e.target.value })}
                      className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 sm:gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2 bg-gray-100 font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-500 text-white font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Add Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 sm:p-6 w-full max-w-md">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Edit Member Details</h2>
              <form onSubmit={updateMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 sm:mb-2">Academic Year for {editingMember.name}</label>
                  <select
                    value={editingMember.academicYear}
                    onChange={(e) => setEditingMember({ 
                      ...editingMember, 
                      academicYear: e.target.value 
                    })}
                    className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    required
                  >
                    {academicYears.map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 sm:mb-2">Role</label>
                  <select 
                    value={editingMember.role}
                    onChange={(e) => setEditingMember({ 
                      ...editingMember, 
                      role: e.target.value 
                    })}
                    className="w-full p-2 text-sm border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    required
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 sm:gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2 bg-gray-100 font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-500 text-white font-bold rounded-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
