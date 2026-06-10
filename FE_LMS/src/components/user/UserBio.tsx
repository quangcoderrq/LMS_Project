import React from "react";
import { useTheme } from "../../hooks/useTheme";
import { Mail, Phone, Calendar, GraduationCap, Star, CheckCircle, XCircle, Clock, User as UserIcon, Edit2 } from "lucide-react";

export interface UserBioData {
  _id: string;
  username: string;
  email?: string;
  role: string;
  fullname?: string;
  phone_number?: string;
  bio?: string;
  isVerified?: boolean;
  status?: string;
  specialistIds?: Array<{
    _id: string;
    name: string;
    description?: string;
    code?: string;
    majorId?: string | { _id: string; name: string };
    major?: { _id: string; name: string };
  }>;
  major?: { _id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
  avatar_url?: string;
}

interface UserBioProps {
  user: UserBioData;
  showFullDetails?: boolean;
  averageRating?: number;
  canEdit?: boolean;
  onEditFullname?: () => void;
  onEditSpecialists?: () => void;
}

const UserBio: React.FC<UserBioProps> = ({ user, showFullDetails = true, averageRating, canEdit = false, onEditFullname, onEditSpecialists }) => {
  const { darkMode } = useTheme();

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
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
      }}
    >
      {/* Header Section */}
      <div
        className="p-6 border-b"
        style={{
          borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
          background: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {user.avatar_url ? (
              <img
                className="h-32 w-32 rounded-full object-cover border-4"
                src={user.avatar_url}
                alt={user.fullname || user.username}
                style={{
                  borderColor: darkMode ? 'rgba(75, 85, 99, 0.5)' : '#e5e7eb',
                }}
              />
            ) : (
              <div
                className="h-32 w-32 rounded-full flex items-center justify-center text-4xl font-bold text-white border-4"
                style={{
                  backgroundColor: darkMode ? '#4c1d95' : '#4f46e5',
                  borderColor: darkMode ? 'rgba(75, 85, 99, 0.5)' : '#e5e7eb',
                }}
              >
                {(user.fullname || user.username).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
                >
                  {user.fullname || user.username}
                </h2>
                {canEdit && onEditFullname && (
                  <button
                    onClick={onEditFullname}
                    className="p-1 rounded hover:bg-opacity-20 transition-colors"
                    style={{
                      color: darkMode ? '#9ca3af' : '#6b7280',
                    }}
                    title="Edit fullname"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
              {user.fullname && (
                <span
                  className="text-lg"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  @{user.username}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="px-3 py-1 text-sm font-semibold rounded-full"
                style={{
                  backgroundColor: getRoleBadgeColor(user.role),
                  color: darkMode ? '#ffffff' : '#1f2937',
                }}
              >
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              {user.status && (
                <span
                  className="px-3 py-1 text-sm font-semibold rounded-full"
                  style={{
                    backgroundColor: getStatusBadgeColor(user.status),
                    color: darkMode ? '#ffffff' : '#1f2937',
                  }}
                >
                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </span>
              )}
              {user.isVerified !== undefined && (
                <span
                  className="px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: user.isVerified
                      ? (darkMode ? 'rgba(34, 197, 94, 0.7)' : 'rgba(34, 197, 94, 0.2)')
                      : (darkMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.2)'),
                    color: darkMode ? '#ffffff' : '#1f2937',
                  }}
                >
                  {user.isVerified ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Not Verified
                    </>
                  )}
                </span>
              )}
              {user.role === 'teacher' && averageRating !== undefined && (
                <span
                  className="px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.1)',
                    color: darkMode ? '#fbbf24' : '#d97706',
                  }}
                >
                  <Star className="w-4 h-4 fill-current" />
                  {averageRating.toFixed(1)} Rating
                </span>
              )}
            </div>

            {user.bio && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: darkMode ? '#d1d5db' : '#4b5563' }}
              >
                {user.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Details Section */}
      {showFullDetails && (
        <div className="p-6">
          <h3
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
          >
            <UserIcon className="w-5 h-5" />
            Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.email && (
              <div>
                <label
                  className="block text-sm font-medium mb-1 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <p
                  className="text-sm"
                  style={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                >
                  {user.email}
                </p>
              </div>
            )}

            {user.phone_number && (
              <div>
                <label
                  className="block text-sm font-medium mb-1 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <Phone className="w-4 h-4" />
                  Phone Number
                </label>
                <p
                  className="text-sm"
                  style={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                >
                  {user.phone_number}
                </p>
              </div>
            )}

            {user.major && (
              <div>
                <label
                  className="block text-sm font-medium mb-1 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <GraduationCap className="w-4 h-4" />
                  Major
                </label>
                <p
                  className="text-sm"
                  style={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                >
                  {user.major.name}
                </p>
              </div>
            )}

            {((user.specialistIds && user.specialistIds.length > 0) || (canEdit && onEditSpecialists)) && (
              <div className="md:col-span-2">
                <label
                  className="block text-sm font-medium mb-2 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <GraduationCap className="w-4 h-4" />
                  Specializations
                  {canEdit && onEditSpecialists && (
                    <button
                      onClick={onEditSpecialists}
                      className="p-1 rounded hover:bg-opacity-20 transition-colors ml-1"
                      style={{
                        color: darkMode ? '#9ca3af' : '#6b7280',
                      }}
                      title="Edit specializations"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </label>
                {user.specialistIds && user.specialistIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.specialistIds.map((specialist) => (
                      <span
                        key={specialist._id}
                        className="px-3 py-1 text-sm rounded-lg"
                        style={{
                          backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                          color: darkMode ? '#93c5fd' : '#1e40af',
                          border: `1px solid ${darkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                        }}
                      >
                        {specialist.name}
                      </span>
                    ))}
                  </div>
                ) : canEdit && onEditSpecialists ? (
                  <p className="text-sm" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    No specializations. Click the edit icon to add.
                  </p>
                ) : null}
              </div>
            )}

            {user.createdAt && (
              <div>
                <label
                  className="block text-sm font-medium mb-1 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <Calendar className="w-4 h-4" />
                  Member Since
                </label>
                <p
                  className="text-sm flex items-center gap-1"
                  style={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                >
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {(() => {
                  const memberSince = new Date(user.createdAt);
                  const today = new Date();
                  const diffTime = Math.abs(today.getTime() - memberSince.getTime());
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  
                  let displayText = '';
                  if (diffDays === 0) {
                    displayText = 'Today';
                  } else if (diffDays === 1) {
                    displayText = '1 day';
                  } else if (diffDays < 30) {
                    displayText = `${diffDays} days`;
                  } else if (diffDays < 365) {
                    const months = Math.floor(diffDays / 30);
                    displayText = months === 1 ? '1 month' : `${months} months`;
                  } else {
                    const years = Math.floor(diffDays / 365);
                    const remainingMonths = Math.floor((diffDays % 365) / 30);
                    if (remainingMonths === 0) {
                      displayText = years === 1 ? '1 year' : `${years} years`;
                    } else {
                      displayText = `${years} year${years > 1 ? 's' : ''} and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
                    }
                  }
                  
                  return (
                    <p
                      className="text-xs mt-1 flex items-center gap-1"
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    >
                      Member for {displayText}
                    </p>
                  );
                })()}
              </div>
            )}

            {user.updatedAt && (
              <div>
                <label
                  className="block text-sm font-medium mb-1 flex items-center gap-2"
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  <Clock className="w-4 h-4" />
                  Last Updated
                </label>
                <p
                  className="text-sm flex items-center gap-1"
                  style={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                >
                  {new Date(user.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBio;

