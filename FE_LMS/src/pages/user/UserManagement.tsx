import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { userService } from "../../services/userService";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { Search, Filter, X } from "lucide-react";

interface UserData {
  _id: string;
  username: string;
  email: string;
  role: string;
  isVerified: boolean;
  status: string;
  fullname?: string;
  specialistIds?: any[];
  createdAt: string;
  updatedAt: string;
  avatar_url?: string;
  key?: string;
}

const UserManagement: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search state - single search input
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter states
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterIsVerified, setFilterIsVerified] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [paginationInfo, setPaginationInfo] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);
  
  const [contentPaddingLeft, setContentPaddingLeft] = useState(window.innerWidth >= 640 ? 93 : 0);

  useEffect(() => {
    function handleResize() {
      setContentPaddingLeft(window.innerWidth >= 640 ? 93 : 0);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      // If searching, make 2 separate calls (username, fullname) and merge results
      if (searchTerm.trim()) {
        const searchPromises: Promise<any>[] = [];
        
        // Make 2 API calls with the same search term
        searchPromises.push(
          userService.getUsers({
            page: 1,
            limit: 100, // Get all results for merging
            username: searchTerm.trim(),
            ...(filterRole && { role: filterRole }),
            ...(filterIsVerified !== "" && { isVerified: filterIsVerified === "true" }),
            ...(filterStatus && { status: filterStatus }),
          })
        );
        
        searchPromises.push(
          userService.getUsers({
            page: 1,
            limit: 100,
            fullname: searchTerm.trim(),
            ...(filterRole && { role: filterRole }),
            ...(filterIsVerified !== "" && { isVerified: filterIsVerified === "true" }),
            ...(filterStatus && { status: filterStatus }),
          })
        );

        const results = await Promise.all(searchPromises);
        
        // Merge results and remove duplicates
        const mergedUsers = new Map<string, UserData>();
        results.forEach(result => {
          (result.users as any[]).forEach((u: any) => {
            if (!mergedUsers.has(u._id)) {
              mergedUsers.set(u._id, u as UserData);
            }
          });
        });

        const uniqueUsers = Array.from(mergedUsers.values());
        
        // Apply pagination to merged results
        const startIndex = (currentPage - 1) * pageLimit;
        const endIndex = startIndex + pageLimit;
        const paginatedUsers = uniqueUsers.slice(startIndex, endIndex);
        
        setUsers(paginatedUsers);
        setTotalUsers(uniqueUsers.length);
        setPaginationInfo({
          total: uniqueUsers.length,
          page: currentPage,
          limit: pageLimit,
          totalPages: Math.ceil(uniqueUsers.length / pageLimit),
          hasNext: endIndex < uniqueUsers.length,
          hasPrev: currentPage > 1,
        });
      } else {
        // Normal fetch with filters
        const result = await userService.getUsers({
          page: currentPage,
          limit: pageLimit,
          ...(filterRole && { role: filterRole }),
          ...(filterIsVerified !== "" && { isVerified: filterIsVerified === "true" }),
          ...(filterStatus && { status: filterStatus }),
        });

        setUsers((result.users as any[]) || []);
        if (result.pagination) {
          setTotalUsers(result.pagination.total || 0);
          setPaginationInfo({
            total: result.pagination.total || 0,
            page: result.pagination.page || currentPage,
            limit: result.pagination.limit || pageLimit,
            totalPages: result.pagination.totalPages || 1,
            hasNext: result.pagination.hasNext || false,
            hasPrev: result.pagination.hasPrev || false,
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageLimit, filterRole, filterIsVerified, filterStatus]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers();
  };

  const clearFilters = () => {
    setFilterRole("");
    setFilterIsVerified("");
    setFilterStatus("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const changePageLimit = (limit: number) => {
    setPageLimit(limit);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return darkMode ? "rgba(168, 85, 247, 0.7)" : "rgba(168, 85, 247, 0.2)";
      case "teacher":
        return darkMode ? "rgba(59, 130, 246, 0.7)" : "rgba(59, 130, 246, 0.2)";
      case "student":
        return darkMode ? "rgba(34, 197, 94, 0.7)" : "rgba(34, 197, 94, 0.2)";
      default:
        return darkMode ? "rgba(107, 114, 128, 0.7)" : "rgba(107, 114, 128, 0.2)";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return darkMode ? "rgba(34, 197, 94, 0.7)" : "rgba(34, 197, 94, 0.2)";
      case "inactive":
        return darkMode ? "rgba(239, 68, 68, 0.7)" : "rgba(239, 68, 68, 0.2)";
      default:
        return darkMode ? "rgba(107, 114, 128, 0.7)" : "rgba(107, 114, 128, 0.2)";
    }
  };

  return (
    <>
      <div
        className="flex h-screen overflow-hidden relative"
        style={{
          backgroundColor: darkMode ? '#1a202c' : '#f8fafc',
          color: darkMode ? '#ffffff' : '#1e293b'
        }}
      >
        {/* Navigation */}
        <Navbar />

        {/* Sidebar */}
        <Sidebar role={(user?.role as 'admin' | 'teacher' | 'student') || 'student'} />

        {/* Main Content */}
        <div 
          className="flex flex-col flex-1 w-0 overflow-hidden" 
          style={{ 
            paddingLeft: contentPaddingLeft, 
            backgroundColor: darkMode ? '#1f2937' : '#f0f0f0' 
          }}
        >
          <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1
                    className="text-3xl font-bold mb-2"
                    style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
                  >
                    User Management
                  </h1>
                  <p
                    style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                  >
                    View and manage all users in the system
                  </p>
                </div>
                <button
                  className="px-4 py-2 rounded-lg text-white flex items-center transition-all duration-200 hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: darkMode ? '#4c1d95' : '#4f46e5' }}
                  onClick={fetchUsers}
                >
                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Search and Filter Controls */}
              <div className="mb-6 space-y-4">
                {/* Search Field - Single input that searches username and fullname */}
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search by username or fullname..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-4 py-2 rounded-lg border transition-colors duration-300"
                      style={{
                        backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="p-2 rounded-lg text-white transition-all duration-200 flex items-center justify-center hover:opacity-90 hover:scale-105"
                    style={{ backgroundColor: darkMode ? '#4c1d95' : '#4f46e5' }}
                  >
                    <Search size={20} />
                  </button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="p-2 rounded-lg border transition-all duration-200 flex items-center justify-center hover:opacity-90"
                    style={{
                      backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      color: darkMode ? '#ffffff' : '#000000',
                    }}
                  >
                    <Filter size={20} />
                  </button>
                  
                  {/* Pagination Controls - Top */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <select
                        value={pageLimit}
                        onChange={(e) => changePageLimit(Number(e.target.value))}
                        className="appearance-none rounded-lg px-4 py-2 pr-10 border focus:outline-none focus:ring-2 transition-colors duration-200 shadow-sm"
                        style={{
                          width: 135,
                          fontWeight: 600,
                          background: darkMode ? '#152632' : '#ffffff',
                          color: darkMode ? '#ffffff' : '#111827',
                          borderColor: darkMode ? '#334155' : '#e5e7eb',
                          boxShadow: darkMode ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.06)'
                        }}
                      >
                        {[5, 10, 25, 50, 75, 100].map(l => (
                          <option key={l} value={l}>{l} / page</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                          aria-hidden="true"
                        >
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.062l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </div>
                    <span style={{
                      minWidth: 100,
                      fontVariantNumeric: 'tabular-nums',
                      color: darkMode ? '#e5e7eb' : '#223344'
                    }}>
                      {paginationInfo 
                        ? `${(pageLimit * (currentPage - 1)) + 1} – ${Math.min(pageLimit * currentPage, totalUsers)} of ${totalUsers}`
                        : `0 – 0 of 0`}
                    </span>
                    <button
                      className="px-4 py-1 rounded border disabled:opacity-40"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={!paginationInfo?.hasPrev}
                      title="Previous page"
                      style={{
                        background: darkMode ? '#223344' : '#ffffff',
                        color: darkMode ? '#fff' : '#223344',
                        borderColor: darkMode ? '#334155' : '#e5e7eb'
                      }}
                    >
                      &#x2039;
                    </button>
                    <button
                      className="px-4 py-1 rounded border disabled:opacity-40"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={!paginationInfo?.hasNext}
                      title="Next page"
                      style={{
                        background: darkMode ? '#223344' : '#ffffff',
                        color: darkMode ? '#fff' : '#223344',
                        borderColor: darkMode ? '#334155' : '#e5e7eb'
                      }}
                    >
                      &#x203A;
                    </button>
                  </div>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                  <div 
                    className="p-4 rounded-lg border space-y-4"
                    style={{
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        Filters
                      </h3>
                      <button
                        onClick={clearFilters}
                        className="text-sm flex items-center gap-1 px-2 py-1 rounded hover:opacity-80"
                        style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                      >
                        <X size={16} />
                        Clear All
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>
                          Role
                        </label>
                        <select
                          value={filterRole}
                          onChange={(e) => {
                            setFilterRole(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full px-4 py-2 rounded-lg border transition-colors"
                          style={{
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                            borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            color: darkMode ? '#ffffff' : '#000000',
                          }}
                        >
                          <option value="">All Roles</option>
                          <option value="admin">Admin</option>
                          <option value="teacher">Teacher</option>
                          <option value="student">Student</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>
                          Verification Status
                        </label>
                        <select
                          value={filterIsVerified}
                          onChange={(e) => {
                            setFilterIsVerified(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full px-4 py-2 rounded-lg border transition-colors"
                          style={{
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                            borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            color: darkMode ? '#ffffff' : '#000000',
                          }}
                        >
                          <option value="">All</option>
                          <option value="true">Verified</option>
                          <option value="false">Not Verified</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>
                          Status
                        </label>
                        <select
                          value={filterStatus}
                          onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full px-4 py-2 rounded-lg border transition-colors"
                          style={{
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                            borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            color: darkMode ? '#ffffff' : '#000000',
                          }}
                        >
                          <option value="">All Status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', color: darkMode ? '#fca5a5' : '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Users Table */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: darkMode ? '#ffffff' : '#000000' }}></div>
                  <p className="mt-4" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No users found</p>
                </div>
              ) : (
                <>
                  <div 
                    className="rounded-lg border overflow-hidden mb-4"
                    style={{
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb'}` }}>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              Verified
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                              Created
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb' }}>
                          {users.map((user) => (
                            <tr 
                              key={user._id} 
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={() => navigate(`/user/${user._id}`, { state: { userData: user } })}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {user.avatar_url ? (
                                    <img
                                      className="h-10 w-10 rounded-full mr-3"
                                      src={user.avatar_url}
                                      alt={user.username}
                                    />
                                  ) : (
                                    <div 
                                      className="h-10 w-10 rounded-full mr-3 flex items-center justify-center text-white font-semibold"
                                      style={{ backgroundColor: darkMode ? '#4c1d95' : '#4f46e5' }}
                                    >
                                      {user.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                      {user.fullname || user.username}
                                    </div>
                                    <div className="text-sm" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                      @{user.username}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>
                                  {user.email}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="px-2 py-1 text-xs font-semibold rounded-full"
                                  style={{
                                    backgroundColor: getRoleBadgeColor(user.role),
                                    color: darkMode ? '#ffffff' : '#1f2937',
                                  }}
                                >
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="px-2 py-1 text-xs font-semibold rounded-full"
                                  style={{
                                    backgroundColor: getStatusBadgeColor(user.status),
                                    color: darkMode ? '#ffffff' : '#1f2937',
                                  }}
                                >
                                  {user.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="px-2 py-1 text-xs font-semibold rounded-full"
                                  style={{
                                    backgroundColor: user.isVerified 
                                      ? (darkMode ? 'rgba(34, 197, 94, 0.7)' : 'rgba(34, 197, 94, 0.2)')
                                      : (darkMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.2)'),
                                    color: darkMode ? '#ffffff' : '#1f2937',
                                  }}
                                >
                                  {user.isVerified ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                {new Date(user.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls - Bottom (only next page and page number selector) */}
                  <div className="flex items-center justify-end gap-3 flex-wrap mt-4">
                    {paginationInfo && paginationInfo.totalPages > 0 && (
                      <>
                        <span style={{
                          color: darkMode ? '#e5e7eb' : '#223344',
                          fontSize: '14px'
                        }}>
                          Page
                        </span>
                        <select
                          value={currentPage}
                          onChange={(e) => goToPage(Number(e.target.value))}
                          className="appearance-none rounded-lg px-4 py-2 pr-10 border focus:outline-none focus:ring-2 transition-colors duration-200 shadow-sm"
                          style={{
                            width: 80,
                            fontWeight: 600,
                            background: darkMode ? '#152632' : '#ffffff',
                            color: darkMode ? '#ffffff' : '#111827',
                            borderColor: darkMode ? '#334155' : '#e5e7eb',
                            boxShadow: darkMode ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.06)'
                          }}
                        >
                          {Array.from({ length: paginationInfo.totalPages }, (_, i) => i + 1).map(pageNum => (
                            <option key={pageNum} value={pageNum}>{pageNum}</option>
                          ))}
                        </select>
                        <span style={{
                          color: darkMode ? '#e5e7eb' : '#223344',
                          fontSize: '14px'
                        }}>
                          of {paginationInfo.totalPages}
                        </span>
                        <button
                          className="px-4 py-1 rounded border disabled:opacity-40"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={!paginationInfo?.hasNext}
                          title="Next page"
                          style={{
                            background: darkMode ? '#223344' : '#ffffff',
                            color: darkMode ? '#fff' : '#223344',
                            borderColor: darkMode ? '#334155' : '#e5e7eb'
                          }}
                        >
                          &#x203A;
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default UserManagement;

