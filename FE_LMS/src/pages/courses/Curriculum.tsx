import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import {
  specialistService,
  majorService,
  subjectService,
  courseService,
} from "../../services";
import { generateSlug } from "../../utils/slug";
import type { Specialist } from "../../types/specialist";
import type {
  MajorNode,
  SpecialistNode,
  SubjectNode,
} from "../../types/curriculum";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { Plus } from "lucide-react";
import SearchFilters from "../../components/curriculum/SearchFilters";
import MajorRow from "../../components/curriculum/MajorRow";
import SpecialistModal from "../../components/curriculum/SpecialistModal";
import MajorModal from "../../components/curriculum/MajorModal";
import SubjectModal from "../../components/curriculum/SubjectModal";
import CourseModal from "../../components/curriculum/CourseModal";
import PendingChangesDialog from "../../components/curriculum/PendingChangesDialog";
import TabNavigation from "../../components/curriculum/TabNavigation";
import MajorsTable from "../../components/curriculum/MajorsTable";
import SpecialistsTable from "../../components/curriculum/SpecialistsTable";
import SubjectsTable from "../../components/curriculum/SubjectsTable";
import SemesterList from "../../components/curriculum/SemesterList";

const Curriculum: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [majors, setMajors] = useState<MajorNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set());
  const [expandedSpecialists, setExpandedSpecialists] = useState<Set<string>>(
    new Set()
  );
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );
  const [contentPaddingLeft, setContentPaddingLeft] = useState(
    window.innerWidth >= 640 ? 93 : 0
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [totalMajors, setTotalMajors] = useState(0);
  const [sortOption, setSortOption] = useState<
    "name_asc" | "name_desc" | "date_asc" | "date_desc"
  >("date_desc");
  const majorsRef = useRef<MajorNode[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "tree" | "majors" | "specialists" | "subjects" | "semester"
  >("tree");
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);

  useEffect(() => {
    majorsRef.current = majors;
  }, [majors]);

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<{
    type: "specialist" | "subject";
    id: string;
    data: any;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    type: "major" | "specialist";
    id: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Pending moves state with change history
  interface PendingMove {
    id: string;
    type: "specialist" | "subject";
    itemName: string;
    itemCode?: string;
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    timestamp: number;
  }

  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [moveHistory, setMoveHistory] = useState<PendingMove[]>([]); // For undo/redo
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Major CRUD state
  const [showMajorModal, setShowMajorModal] = useState(false);
  const [editingMajorId, setEditingMajorId] = useState<string | null>(null);
  const [majorFormData, setMajorFormData] = useState({
    name: "",
    description: "",
  });

  // Specialist CRUD states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(
    null
  );
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    majorId: "",
  });

  // Subject CRUD states
  type SubjectFormState = {
    name: string;
    code: string;
    credits: number | "";
    description: string;
    isActive: boolean;
    specialistId?: string;
  };

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectContext, setSubjectContext] = useState<{
    majorId: string;
    specialistId: string;
    specialistName: string;
  } | null>(null);
  const [subjectFormData, setSubjectFormData] = useState<SubjectFormState>({
    name: "",
    code: "",
    credits: 3,
    description: "",
    isActive: true,
  });

  // Course modal state
  interface CourseFormState {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    teacherIds: string[];
    status: "ongoing" | "draft" | "completed";
    isPublished: boolean;
    capacity: number;
    enrollRequiresApproval: boolean;
    semesterId?: string;
    logo?: File | null;
  }

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseContext, setCourseContext] = useState<{
    majorId: string;
    specialistId: string;
    subjectId: string;
    subjectName: string;
  } | null>(null);
  const [courseFormData, setCourseFormData] = useState<CourseFormState>({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    teacherIds: [],
    status: "draft",
    isPublished: false,
    capacity: 50,
    enrollRequiresApproval: true,
    semesterId: undefined,
    logo: null,
  });

  // Info card state - track which row's info is open by ID
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  const handleShowInfo = (
    type: "major" | "specialist" | "subject" | "course",
    data: any
  ) => {
    const id = `${type}-${data._id}`;
    if (openInfoId === id) {
      // If clicking the same row, close it
      setOpenInfoId(null);
    } else {
      // Open new info row
      setOpenInfoId(id);
    }
  };

  const handleCloseInfo = () => {
    setOpenInfoId(null);
  };

  const changePageLimit = (limit: number) => {
    setPageLimit(limit);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const loadSpecialistsForMajor = useCallback(
    async (majorId: string, force = false) => {
      const currentMajor = majorsRef.current.find(
        (major) => major._id === majorId
      );
      if (currentMajor?.specialistsLoaded && !force) {
        return;
      }

      setMajors((prev) =>
        prev.map((major) =>
          major._id === majorId
            ? {
                ...major,
                specialistsLoading: true,
                specialistsError: "",
              }
            : major
        )
      );

      const isNameSort =
        sortOption === "name_asc" || sortOption === "name_desc";
      const order = sortOption.endsWith("asc") ? "asc" : "desc";

      try {
        const { specialists } = await specialistService.getAllSpecialists({
          majorId,
          limit: 100,
          ...(isNameSort ? { sortBy: "name" as const } : {}),
          sortOrder: order,
        });

        setMajors((prev) =>
          prev.map((major) => {
            if (major._id !== majorId) return major;

            const existingSpecialists = major.specialists || [];
            const existingMap = new Map(
              existingSpecialists.map((spec) => [spec._id, spec])
            );

            const specialistNodes: SpecialistNode[] = specialists.map(
              (spec) => {
                const existing = existingMap.get(spec._id);
                return {
                  ...existing,
                  ...spec,
                  subjects: existing?.subjects || [],
                  subjectsLoaded: existing?.subjectsLoaded ?? false,
                  subjectsLoading: false,
                  subjectsError: existing?.subjectsError || "",
                };
              }
            );

            return {
              ...major,
              specialists: specialistNodes,
              specialistsLoaded: true,
              specialistsLoading: false,
              specialistsError: "",
            };
          })
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load specialists";
        setMajors((prev) =>
          prev.map((major) =>
            major._id === majorId
              ? {
                  ...major,
                  specialistsLoading: false,
                  specialistsError: message,
                }
              : major
          )
        );
      }
    },
    [sortOption]
  );

  const loadSubjectsForSpecialist = async (
    majorId: string,
    specialistId: string,
    force = false
  ) => {
    const currentMajor = majorsRef.current.find(
      (major) => major._id === majorId
    );
    const currentSpecialist = currentMajor?.specialists?.find(
      (spec) => spec._id === specialistId
    );
    if (currentSpecialist?.subjectsLoaded && !force) {
      return;
    }

    setMajors((prev) =>
      prev.map((major) => {
        if (major._id !== majorId) return major;
        return {
          ...major,
          specialists: (major.specialists || []).map((spec) =>
            spec._id === specialistId
              ? { ...spec, subjectsLoading: true, subjectsError: "" }
              : spec
          ),
        };
      })
    );

    try {
      const subjectsResponse = await subjectService.getAllSubjects({
        specialistId,
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      });

      const subjects = subjectsResponse.data || [];

      setMajors((prev) =>
        prev.map((major) => {
          if (major._id !== majorId) return major;
          return {
            ...major,
            specialists: (major.specialists || []).map((spec) => {
              if (spec._id !== specialistId) return spec;

              const existingSubjects = spec.subjects || [];
              const existingMap = new Map(
                existingSubjects.map((subject) => [subject._id, subject])
              );

              const subjectNodes: SubjectNode[] = subjects.map((subject) => {
                const existing = existingMap.get(subject._id);
                return {
                  ...existing,
                  ...subject,
                  courses: existing?.courses || [],
                  coursesLoaded: existing?.coursesLoaded ?? false,
                  coursesLoading: false,
                  coursesError: existing?.coursesError || "",
                };
              });

              return {
                ...spec,
                subjects: subjectNodes,
                subjectsLoaded: true,
                subjectsLoading: false,
                subjectsError: "",
              };
            }),
          };
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load subjects";
      setMajors((prev) =>
        prev.map((major) => {
          if (major._id !== majorId) return major;
          return {
            ...major,
            specialists: (major.specialists || []).map((spec) =>
              spec._id === specialistId
                ? { ...spec, subjectsLoading: false, subjectsError: message }
                : spec
            ),
          };
        })
      );
    }
  };

  const loadCoursesForSubject = async (
    majorId: string,
    specialistId: string,
    subjectId: string,
    force = false
  ) => {
    const currentMajor = majorsRef.current.find(
      (major) => major._id === majorId
    );
    const currentSpecialist = currentMajor?.specialists?.find(
      (spec) => spec._id === specialistId
    );
    const currentSubject = currentSpecialist?.subjects?.find(
      (subj) => subj._id === subjectId
    );

    if (currentSubject?.coursesLoaded && !force) {
      return;
    }

    setMajors((prev) =>
      prev.map((major) => {
        if (major._id !== majorId) return major;
        return {
          ...major,
          specialists: (major.specialists || []).map((spec) => {
            if (spec._id !== specialistId) return spec;
            return {
              ...spec,
              subjects: (spec.subjects || []).map((subj) =>
                subj._id === subjectId
                  ? { ...subj, coursesLoading: true, coursesError: "" }
                  : subj
              ),
            };
          }),
        };
      })
    );

    try {
      const { courses } = await courseService.getAllCourses({
        subjectId,
        limit: 100,
        sortBy: "title",
        sortOrder: "asc",
      });

      setMajors((prev) =>
        prev.map((major) => {
          if (major._id !== majorId) return major;
          return {
            ...major,
            specialists: (major.specialists || []).map((spec) => {
              if (spec._id !== specialistId) return spec;
              return {
                ...spec,
                subjects: (spec.subjects || []).map((subj) =>
                  subj._id === subjectId
                    ? {
                        ...subj,
                        courses,
                        coursesLoaded: true,
                        coursesLoading: false,
                        coursesError: "",
                      }
                    : subj
                ),
              };
            }),
          };
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load courses";
      setMajors((prev) =>
        prev.map((major) => {
          if (major._id !== majorId) return major;
          return {
            ...major,
            specialists: (major.specialists || []).map((spec) => {
              if (spec._id !== specialistId) return spec;
              return {
                ...spec,
                subjects: (spec.subjects || []).map((subj) =>
                  subj._id === subjectId
                    ? {
                        ...subj,
                        coursesLoading: false,
                        coursesError: message,
                      }
                    : subj
                ),
              };
            }),
          };
        })
      );
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Map unified sort option to backend query
      const isName = sortOption === "name_asc" || sortOption === "name_desc";
      const order = (sortOption.endsWith("asc") ? "asc" : "desc") as
        | "asc"
        | "desc";

      const majorsResult = await majorService.getAllMajors({
        ...(searchTerm && { search: searchTerm }),
        page: currentPage,
        limit: pageLimit,
        ...(isName ? { sortBy: "name" } : {}),
        ...(order ? { sortOrder: order } : {}),
      });

      setMajors((prev) => {
        const prevMap = new Map(prev.map((major) => [major._id, major]));
        return majorsResult.majors.map((major) => {
          const existing = prevMap.get(major._id);
          return {
            ...existing,
            ...major,
            specialists: existing?.specialists || [],
            specialistsLoaded: existing?.specialistsLoaded ?? false,
            specialistsLoading: existing?.specialistsLoading ?? false,
            specialistsError: existing?.specialistsError || "",
          };
        });
      });
      setError("");

      if (
        majorsResult.pagination &&
        typeof majorsResult.pagination === "object"
      ) {
        if ("total" in majorsResult.pagination)
          setTotalMajors(majorsResult.pagination.total as number);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData();
  };

  const toggleMajor = (majorId: string) => {
    const isExpanded = expandedMajors.has(majorId);
    setExpandedMajors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(majorId)) {
        newSet.delete(majorId);
      } else {
        newSet.add(majorId);
      }
      return newSet;
    });

    if (!isExpanded) {
      const targetMajor = majors.find((major) => major._id === majorId);
      if (
        targetMajor &&
        (!targetMajor.specialistsLoaded || targetMajor.specialistsError)
      ) {
        void loadSpecialistsForMajor(majorId);
      }
    }
  };

  const toggleSpecialist = (majorId: string, specialistId: string) => {
    const isExpanded = expandedSpecialists.has(specialistId);
    setExpandedSpecialists((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(specialistId)) {
        newSet.delete(specialistId);
      } else {
        newSet.add(specialistId);
      }
      return newSet;
    });

    if (!isExpanded) {
      const majorNode = majors.find((major) => major._id === majorId);
      const specialistNode = majorNode?.specialists?.find(
        (spec) => spec._id === specialistId
      );
      if (
        specialistNode &&
        (!specialistNode.subjectsLoaded || specialistNode.subjectsError)
      ) {
        void loadSubjectsForSpecialist(majorId, specialistId);
      }
    }
  };

  const toggleSubject = (
    majorId: string,
    specialistId: string,
    subjectId: string
  ) => {
    const isExpanded = expandedSubjects.has(subjectId);
    setExpandedSubjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });

    if (!isExpanded) {
      const majorNode = majors.find((major) => major._id === majorId);
      const specialistNode = majorNode?.specialists?.find(
        (spec) => spec._id === specialistId
      );
      const subjectNode = specialistNode?.subjects?.find(
        (subj) => subj._id === subjectId
      );
      if (
        subjectNode &&
        (!subjectNode.coursesLoaded || subjectNode.coursesError)
      ) {
        void loadCoursesForSubject(majorId, specialistId, subjectId);
      }
    }
  };

  // CRUD Handlers
  const handleCreateSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        slug: generateSlug(formData.name),
        description: formData.description,
      };
      // Only add majorId if it's not empty
      if (formData.majorId && formData.majorId.trim() !== "") {
        payload.majorId = formData.majorId;
      }
      await specialistService.createSpecialist(payload);
      setShowCreateModal(false);
      setFormData({ name: "", description: "", majorId: "" });
      await fetchData();
      setTableRefreshTrigger((prev) => prev + 1);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Specialist created successfully!",
        showConfirmButton: false,
        timer: 2000,
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
        },
      });
    } catch (err: unknown) {
      let msg = "Failed to create specialist";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        msg = axiosError.response?.data?.message || axiosError.message || msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
        },
      });
    }
  };

  const handleEditSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpecialist) return;
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
      };
      // Only add majorId if it's not empty
      if (formData.majorId && formData.majorId.trim() !== "") {
        payload.majorId = formData.majorId;
      }
      await specialistService.updateSpecialist(editingSpecialist._id, payload);
      setShowEditModal(false);
      setEditingSpecialist(null);
      setFormData({ name: "", description: "", majorId: "" });
      await fetchData();
      setTableRefreshTrigger((prev) => prev + 1);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Specialist updated successfully!",
        showConfirmButton: false,
        timer: 2000,
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
        },
      });
    } catch (err: unknown) {
      let msg = "Failed to update specialist";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        msg = axiosError.response?.data?.message || axiosError.message || msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
        },
      });
    }
  };

  const handleDeleteSpecialist = async (id: string) => {
    const Swal = (await import("sweetalert2")).default;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await specialistService.deleteSpecialist(id);
      await fetchData();
      setTableRefreshTrigger((prev) => prev + 1);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Specialist deleted successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete specialist";
      setError(msg);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  const openEditModal = (specialistId: string) => {
    const majorNode = majors.find((major) =>
      major.specialists?.some((spec) => spec._id === specialistId)
    );
    const specialist = majorNode?.specialists?.find(
      (spec) => spec._id === specialistId
    );
    if (specialist) {
      setEditingSpecialist(specialist);
      setFormData({
        name: specialist.name,
        description: specialist.description,
        majorId: specialist.majorId?._id || "",
      });
      setShowEditModal(true);
      setOpenActionMenu(null);
    }
  };

  const openCreateMajorModal = () => {
    setEditingMajorId(null);
    setMajorFormData({ name: "", description: "" });
    setShowMajorModal(true);
  };

  const openEditMajorModal = (major: MajorNode) => {
    setEditingMajorId(major._id);
    setMajorFormData({
      name: major.name || "",
      description: major.description || "",
    });
    setShowMajorModal(true);
    setOpenActionMenu(null);
  };

  const handleMajorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMajorId) {
        await majorService.updateMajor(editingMajorId, {
          name: majorFormData.name,
          description: majorFormData.description || undefined,
        });
      } else {
        await majorService.createMajor({
          name: majorFormData.name,
          slug: generateSlug(majorFormData.name),
          description: majorFormData.description || undefined,
        });
      }
      setShowMajorModal(false);
      setEditingMajorId(null);
      setMajorFormData({ name: "", description: "" });
      await fetchData();
      setTableRefreshTrigger((prev) => prev + 1); // Refresh table views
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save major");
    }
  };

  const handleDeleteMajor = async (majorId: string) => {
    const Swal = (await import("sweetalert2")).default;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await majorService.deleteMajor(majorId);
      setOpenActionMenu(null);
      await fetchData();
      setTableRefreshTrigger((prev) => prev + 1);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Major deleted successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete major";
      setError(msg);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  const openCreateSubjectModal = (
    major: MajorNode,
    specialist: SpecialistNode
  ) => {
    setEditingSubjectId(null);
    setSubjectContext({
      majorId: major._id,
      specialistId: specialist._id,
      specialistName: specialist.name,
    });
    setSubjectFormData({
      name: "",
      code: "",
      credits: 3,
      description: "",
      isActive: true,
    });
    setShowSubjectModal(true);
    setOpenActionMenu(null);
  };

  const openEditSubjectModal = (
    major: MajorNode,
    specialist: SpecialistNode,
    subject: SubjectNode
  ) => {
    setEditingSubjectId(subject._id);
    setSubjectContext({
      majorId: major._id,
      specialistId: specialist._id,
      specialistName: specialist.name,
    });
    setSubjectFormData({
      name: subject.name || "",
      code: subject.code || "",
      credits: subject.credits ?? "",
      description: subject.description || "",
      isActive: subject.isActive ?? true,
    });
    setShowSubjectModal(true);
    setOpenActionMenu(null);
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectContext) return;
    const context = subjectContext;
    try {
      if (editingSubjectId) {
        const updatePayload = {
          name: subjectFormData.name,
          code: subjectFormData.code,
          credits:
            subjectFormData.credits === ""
              ? undefined
              : Number(subjectFormData.credits),
          description: subjectFormData.description || undefined,
          specialistIds: context.specialistId ? [context.specialistId] : [],
          isActive: subjectFormData.isActive,
        };
        await subjectService.updateSubject(editingSubjectId, updatePayload);
      } else {
        const createPayload = {
          name: subjectFormData.name,
          code: subjectFormData.code,
          slug: generateSlug(subjectFormData.name),
          credits:
            subjectFormData.credits === ""
              ? undefined
              : Number(subjectFormData.credits),
          description: subjectFormData.description || undefined,
          specialistIds: context.specialistId ? [context.specialistId] : [],
          isActive: subjectFormData.isActive,
        };
        await subjectService.createSubject(createPayload);
      }
      setShowSubjectModal(false);
      setEditingSubjectId(null);
      setSubjectContext(null);
      setSubjectFormData({
        name: "",
        code: "",
        credits: 3,
        description: "",
        isActive: true,
      });
      // Refresh table view
      setTableRefreshTrigger((prev) => prev + 1);
      // Also refresh tree view if needed
      if (context.majorId && context.specialistId) {
        await loadSubjectsForSpecialist(
          context.majorId,
          context.specialistId,
          true
        );
      }
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: editingSubjectId
          ? "Subject updated successfully!"
          : "Subject created successfully!",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save subject";
      setError(msg);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  const handleDeleteSubject = async (
    majorId: string,
    specialistId: string,
    subjectId: string
  ) => {
    const Swal = (await import("sweetalert2")).default;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await subjectService.deleteSubject(subjectId);
      setOpenActionMenu(null);
      await loadSubjectsForSpecialist(majorId, specialistId, true);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Subject deleted successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete subject";
      setError(msg);
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  // Course CRUD handlers
  const openCreateCourseModal = (
    subject: SubjectNode,
    major: MajorNode,
    specialist: SpecialistNode
  ) => {
    setEditingCourseId(null);
    setCourseContext({
      majorId: major._id,
      specialistId: specialist._id,
      subjectId: subject._id,
      subjectName: subject.name,
    });
    setCourseFormData({
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      teacherIds: [],
      status: "draft",
      isPublished: false,
      capacity: 50,
      enrollRequiresApproval: true,
      semesterId: undefined,
      logo: null,
    });
    setShowCourseModal(true);
    setOpenActionMenu(null);
  };

  const openEditCourseModal = (
    course: any,
    subject: SubjectNode,
    major: MajorNode,
    specialist: SpecialistNode
  ) => {
    setEditingCourseId(course._id);
    setCourseContext({
      majorId: major._id,
      specialistId: specialist._id,
      subjectId: subject._id,
      subjectName: subject.name,
    });

    // Format dates to YYYY-MM-DD
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0];
    };

    // Extract teacher IDs
    const teacherIds = course.teacherIds
      ? course.teacherIds.map((t: any) => (typeof t === "string" ? t : t._id))
      : course.teachers
      ? course.teachers.map((t: any) => t._id)
      : [];

    setCourseFormData({
      title: course.title || "",
      description: course.description || "",
      startDate: formatDate(course.startDate),
      endDate: formatDate(course.endDate),
      teacherIds: teacherIds,
      status: course.status || "draft",
      isPublished: course.isPublished || false,
      capacity: course.capacity || 50,
      enrollRequiresApproval: course.enrollRequiresApproval ?? true,
      semesterId: course.semesterId
        ? typeof course.semesterId === "string"
          ? course.semesterId
          : course.semesterId._id
        : undefined,
      logo: null,
    });
    setShowCourseModal(true);
    setOpenActionMenu(null);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseContext) return;
    const context = courseContext;

    try {
      setLoading(true);
      if (editingCourseId) {
        const updatePayload = {
          subjectId: context.subjectId,
          title: courseFormData.title,
          description: courseFormData.description || undefined,
          startDate: courseFormData.startDate,
          endDate: courseFormData.endDate,
          teacherIds: courseFormData.teacherIds,
          status: courseFormData.status,
          isPublished: courseFormData.isPublished,
          capacity: courseFormData.capacity,
          enrollRequiresApproval: courseFormData.enrollRequiresApproval,
          semesterId: courseFormData.semesterId,
          logo: courseFormData.logo || undefined,
        };
        await courseService.updateCourse(editingCourseId, updatePayload);
      } else {
        const createPayload = {
          subjectId: context.subjectId,
          title: courseFormData.title,
          slug: generateSlug(courseFormData.title),
          description: courseFormData.description || undefined,
          startDate: courseFormData.startDate,
          endDate: courseFormData.endDate,
          teacherIds: courseFormData.teacherIds,
          status: courseFormData.status,
          isPublished: courseFormData.isPublished,
          capacity: courseFormData.capacity,
          enrollRequiresApproval: courseFormData.enrollRequiresApproval,
          semesterId: courseFormData.semesterId,
          logo: courseFormData.logo || undefined,
        };
        await courseService.createCourse(createPayload);
      }

      setShowCourseModal(false);
      setEditingCourseId(null);
      setCourseContext(null);
      setCourseFormData({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        teacherIds: [],
        status: "draft",
        isPublished: false,
        capacity: 50,
        enrollRequiresApproval: true,
        semesterId: undefined,
        logo: null,
      });

      // Reload courses for the subject
      await loadCoursesForSubject(
        context.majorId,
        context.specialistId,
        context.subjectId,
        true
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (
    course: any,
    subject: SubjectNode,
    major: MajorNode,
    specialist: SpecialistNode
  ) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      setLoading(true);
      await courseService.deleteCourse(course._id);
      setOpenActionMenu(null);
      await loadCoursesForSubject(major._id, specialist._id, subject._id, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (
    type: "specialist" | "subject",
    id: string,
    data: any
  ) => {
    setDraggedItem({ type, id, data });
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
  };

  const handleDragOver = (
    e: React.DragEvent,
    targetType: "major" | "specialist",
    targetId: string
  ) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Validate drop target
    const isValidDrop =
      (draggedItem.type === "specialist" && targetType === "major") ||
      (draggedItem.type === "subject" && targetType === "specialist");

    if (isValidDrop) {
      setDropTarget({ type: targetType, id: targetId });
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetType: "major" | "specialist",
    targetId: string
  ) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Handle specialist move to major
    if (draggedItem.type === "specialist" && targetType === "major") {
      const specialist = draggedItem.data;
      const currentMajorId =
        typeof specialist.majorId === "object"
          ? specialist.majorId?._id
          : specialist.majorId;

      if (currentMajorId && currentMajorId !== targetId) {
        // Find source and target major names
        const sourceMajor = majors.find((m) => m._id === currentMajorId);
        const targetMajor = majors.find((m) => m._id === targetId);

        if (sourceMajor && targetMajor) {
          const newMove: PendingMove = {
            id: specialist._id,
            type: "specialist",
            itemName: specialist.name,
            fromId: currentMajorId,
            fromName: sourceMajor.name,
            toId: targetId,
            toName: targetMajor.name,
            timestamp: Date.now(),
          };

          // Remove any existing move for this item
          setPendingMoves((prev) =>
            prev.filter(
              (m) => m.id !== specialist._id || m.type !== "specialist"
            )
          );
          setPendingMoves((prev) => [...prev, newMove]);

          // Optimistic update: move specialist in UI immediately
          applyOptimisticMove(newMove);
        }
      }
    }

    // Handle subject move to specialist
    else if (draggedItem.type === "subject" && targetType === "specialist") {
      const subject = draggedItem.data;
      // Extract specialist IDs, handling both string and object formats
      const currentSpecialistIds = (subject.specialistIds || []).map(
        (id: any) => (typeof id === "object" ? id._id : id)
      );

      if (!currentSpecialistIds.includes(targetId)) {
        // Find source specialist and target specialist
        let sourceSpecialist: any = null;
        let sourceMajor: any = null;

        for (const major of majors) {
          for (const specialist of major.specialists || []) {
            if (currentSpecialistIds.includes(specialist._id)) {
              sourceSpecialist = specialist;
              sourceMajor = major;
              break;
            }
          }
          if (sourceSpecialist) break;
        }

        // Find target specialist
        let targetSpecialist: any = null;
        let targetMajor: any = null;
        for (const major of majors) {
          const specialist = major.specialists?.find((s) => s._id === targetId);
          if (specialist) {
            targetSpecialist = specialist;
            targetMajor = major;
            break;
          }
        }

        if (
          sourceSpecialist &&
          targetSpecialist &&
          sourceMajor &&
          targetMajor
        ) {
          const newMove: PendingMove = {
            id: subject._id,
            type: "subject",
            itemName: subject.name,
            itemCode: subject.code,
            fromId: sourceSpecialist._id,
            fromName: sourceSpecialist.name,
            toId: targetId,
            toName: targetSpecialist.name,
            timestamp: Date.now(),
          };

          // Remove any existing move for this item
          setPendingMoves((prev) =>
            prev.filter((m) => m.id !== subject._id || m.type !== "subject")
          );
          setPendingMoves((prev) => [...prev, newMove]);

          // Optimistic update: move subject in UI immediately
          applyOptimisticMove(newMove);
        }
      }
    }

    handleDragEnd();
  };

  // Optimistic update: show item in new location immediately
  const applyOptimisticMove = (move: PendingMove) => {
    if (move.type === "specialist") {
      // Find and move specialist to new major
      setMajors((prev) => {
        const newMajors = prev.map((major) => {
          // Remove from source major
          if (major._id === move.fromId) {
            return {
              ...major,
              specialists: (major.specialists || []).filter(
                (s) => s._id !== move.id
              ),
            };
          }
          // Add to target major
          if (major._id === move.toId) {
            const specialist = prev
              .flatMap((m) => m.specialists || [])
              .find((s) => s._id === move.id);

            if (specialist) {
              const updatedSpecialist = {
                ...specialist,
                majorId:
                  typeof specialist.majorId === "object"
                    ? { ...specialist.majorId, _id: move.toId }
                    : move.toId,
              } as SpecialistNode;
              return {
                ...major,
                specialists: [...(major.specialists || []), updatedSpecialist],
              };
            }
          }
          return major;
        });
        return newMajors;
      });
    } else if (move.type === "subject") {
      // Find and move subject to new specialist
      setMajors((prev) => {
        const newMajors = prev.map((major) => {
          const updatedSpecialists = (major.specialists || []).map(
            (specialist) => {
              // Remove from source specialist
              if (specialist._id === move.fromId) {
                return {
                  ...specialist,
                  subjects: (specialist.subjects || []).filter(
                    (sub) => sub._id !== move.id
                  ),
                };
              }
              // Add to target specialist
              if (specialist._id === move.toId) {
                const subject = prev
                  .flatMap((m) => m.specialists || [])
                  .flatMap((s) => s.subjects || [])
                  .find((sub) => sub._id === move.id);

                if (subject) {
                  const updatedSubject = {
                    ...subject,
                    specialistIds: [move.toId],
                  };
                  return {
                    ...specialist,
                    subjects: [...(specialist.subjects || []), updatedSubject],
                  };
                }
              }
              return specialist;
            }
          );
          return {
            ...major,
            specialists: updatedSpecialists,
          };
        });
        return newMajors;
      });
    }
  };

  // Pending moves handlers
  const discardPendingMoves = () => {
    // Revert all optimistic updates
    pendingMoves.forEach((move) => revertOptimisticMove(move));
    setPendingMoves([]);
    setMoveHistory([]);
    setHistoryIndex(-1);
    // Refresh data to get original state
    fetchData();
  };

  const removePendingMove = (
    moveId: string,
    moveType: "specialist" | "subject"
  ) => {
    const move = pendingMoves.find(
      (m) => m.id === moveId && m.type === moveType
    );
    if (!move) return;

    // Revert optimistic update for this specific move
    revertOptimisticMove(move);

    // Remove from pending moves
    setPendingMoves((prev) =>
      prev.filter((m) => !(m.id === moveId && m.type === moveType))
    );
  };

  const revertOptimisticMove = (move: PendingMove) => {
    if (move.type === "specialist") {
      // Revert specialist move
      setMajors((prev) => {
        const newMajors = prev.map((major) => {
          // Remove from target major
          if (major._id === move.toId) {
            return {
              ...major,
              specialists: (major.specialists || []).filter(
                (s) => s._id !== move.id
              ),
            };
          }
          // Add back to source major
          if (major._id === move.fromId) {
            const specialist = prev
              .flatMap((m) => m.specialists || [])
              .find((s) => s._id === move.id);

            if (specialist) {
              const revertedSpecialist = {
                ...specialist,
                majorId:
                  typeof specialist.majorId === "object"
                    ? { ...specialist.majorId, _id: move.fromId }
                    : move.fromId,
              } as SpecialistNode;
              return {
                ...major,
                specialists: [...(major.specialists || []), revertedSpecialist],
              };
            }
          }
          return major;
        });
        return newMajors;
      });
    } else if (move.type === "subject") {
      // Revert subject move
      setMajors((prev) => {
        const newMajors = prev.map((major) => {
          const updatedSpecialists = (major.specialists || []).map(
            (specialist) => {
              // Remove from target specialist
              if (specialist._id === move.toId) {
                return {
                  ...specialist,
                  subjects: (specialist.subjects || []).filter(
                    (sub) => sub._id !== move.id
                  ),
                };
              }
              // Add back to source specialist
              if (specialist._id === move.fromId) {
                const subject = prev
                  .flatMap((m) => m.specialists || [])
                  .flatMap((s) => s.subjects || [])
                  .find((sub) => sub._id === move.id);

                if (subject) {
                  const revertedSubject = {
                    ...subject,
                    specialistIds: [move.fromId],
                  };
                  return {
                    ...specialist,
                    subjects: [...(specialist.subjects || []), revertedSubject],
                  };
                }
              }
              return specialist;
            }
          );
          return {
            ...major,
            specialists: updatedSpecialists,
          };
        });
        return newMajors;
      });
    }
  };

  const undoLastMove = () => {
    if (pendingMoves.length === 0) return;

    const lastMove = pendingMoves[pendingMoves.length - 1];
    revertOptimisticMove(lastMove);

    // Add to history for redo
    setMoveHistory((prev) => [...prev, lastMove]);
    setHistoryIndex((prev) => prev + 1);

    // Remove from pending
    setPendingMoves((prev) => prev.slice(0, -1));
  };

  const redoLastMove = () => {
    if (historyIndex < 0 || historyIndex >= moveHistory.length) return;

    const moveToRedo = moveHistory[historyIndex];
    applyOptimisticMove(moveToRedo);

    // Add back to pending
    setPendingMoves((prev) => [...prev, moveToRedo]);

    // Remove from history
    setMoveHistory((prev) => prev.slice(0, -1));
    setHistoryIndex((prev) => prev - 1);
  };

  const applyPendingMoves = async () => {
    try {
      setLoading(true);

      // Track affected majors (source and target)
      const affectedMajorIds = new Set<string>();

      // Apply specialist moves
      const specialistMoves = pendingMoves.filter(
        (m) => m.type === "specialist"
      );
      for (const move of specialistMoves) {
        affectedMajorIds.add(move.fromId);
        affectedMajorIds.add(move.toId);
        await specialistService.updateSpecialist(move.id, {
          majorId: move.toId,
        });
      }

      // Apply subject moves - need to find majors for specialists
      const subjectMoves = pendingMoves.filter((m) => m.type === "subject");
      for (const move of subjectMoves) {
        // Find majors for source and target specialists
        for (const major of majors) {
          const sourceSpec = major.specialists?.find(
            (s) => s._id === move.fromId
          );
          const targetSpec = major.specialists?.find(
            (s) => s._id === move.toId
          );
          if (sourceSpec) affectedMajorIds.add(major._id);
          if (targetSpec) affectedMajorIds.add(major._id);
        }
        await subjectService.updateSubject(move.id, {
          specialistIds: [move.toId],
        });
      }

      // Store which majors were expanded before refresh
      const previouslyExpandedMajors = new Set(expandedMajors);
      const previouslyExpandedSpecialists = new Set(expandedSpecialists);

      // Clear pending moves
      setPendingMoves([]);
      setMoveHistory([]);
      setHistoryIndex(-1);

      // Refresh the entire tree
      await fetchData();

      // Use a small delay to ensure state is updated, then refresh expanded nodes
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Reload specialists and subjects for affected majors that were expanded
      for (const majorId of affectedMajorIds) {
        if (previouslyExpandedMajors.has(majorId)) {
          // Ensure the major is expanded
          if (!expandedMajors.has(majorId)) {
            setExpandedMajors((prev) => new Set([...prev, majorId]));
          }

          // Force reload specialists
          await loadSpecialistsForMajor(majorId, true);

          // Get the updated major with fresh specialists
          const updatedMajor = majorsRef.current.find((m) => m._id === majorId);

          // Reload subjects for expanded specialists
          if (updatedMajor?.specialists) {
            for (const specialist of updatedMajor.specialists) {
              if (previouslyExpandedSpecialists.has(specialist._id)) {
                await loadSubjectsForSpecialist(majorId, specialist._id, true);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply move changes"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleResize() {
      setContentPaddingLeft(window.innerWidth >= 640 ? 93 : 0);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch data on param change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [currentPage, pageLimit, sortOption]);

  // Auto-expand the first major on initial load
  useEffect(() => {
    if (majors.length > 0 && expandedMajors.size === 0) {
      const firstMajorId = majors[0]._id;
      setExpandedMajors(new Set([firstMajorId]));
      void loadSpecialistsForMajor(firstMajorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majors.length]);

  return (
    <>
      <div
        className="flex h-screen overflow-hidden relative"
        style={{
          backgroundColor: darkMode ? "#1a202c" : "#f8fafc",
          color: darkMode ? "#ffffff" : "#1e293b",
        }}
      >
        {/* Navigation */}
        <Navbar />

        {/* Sidebar */}
        <Sidebar
          role={(user?.role as "admin" | "teacher" | "student") || "student"}
        />

        {/* Main Content */}
        <div
          className="flex flex-col flex-1 w-0 overflow-hidden"
          style={{
            paddingLeft: contentPaddingLeft,
            backgroundColor: darkMode ? "#1f2937" : "#f0f0f0",
          }}
        >
          <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16">
            <div className="max-w-full mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1
                    className="text-3xl font-bold mb-2"
                    style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                  >
                    Curriculum
                  </h1>
                  <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                    Browse majors and their associated specialists
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 rounded-lg text-white flex items-center transition-all duration-200"
                    style={{
                      backgroundColor: darkMode ? "#2563eb" : "#3b82f6",
                    }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#1d4ed8" : "#2563eb")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#2563eb" : "#3b82f6")
                    }
                    onClick={openCreateMajorModal}
                  >
                    <Plus size={18} className="mr-2" />
                    Create Major
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-white flex items-center transition-all duration-200"
                    style={{
                      backgroundColor: darkMode ? "#059669" : "#10b981",
                    }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#047857" : "#059669")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#059669" : "#10b981")
                    }
                    onClick={() => {
                      setFormData({ name: "", description: "", majorId: "" });
                      setShowCreateModal(true);
                    }}
                  >
                    <Plus size={18} className="mr-2" />
                    Create Specialist
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-white flex items-center transition-all duration-200"
                    style={{
                      backgroundColor: darkMode ? "#4c1d95" : "#4f46e5",
                    }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#5b21b6" : "#4338ca")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.backgroundColor =
                        darkMode ? "#4c1d95" : "#4f46e5")
                    }
                    onClick={fetchData}
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

              {/* TreeView Content */}
              {activeTab === "tree" && (
                <>
                  {/* Search and Filter Controls */}
                  <SearchFilters
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    pageLimit={pageLimit}
                    onPageLimitChange={changePageLimit}
                    currentPage={currentPage}
                    totalMajors={totalMajors}
                    onPageChange={goToPage}
                  />

                  {/* Loading State */}
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <div
                        className="animate-spin rounded-full h-12 w-12 border-b-2"
                        style={{
                          borderColor: darkMode ? "#6366f1" : "#4f46e5",
                        }}
                      ></div>
                    </div>
                  )}

                  {/* Error State */}
                  {error && (
                    <div
                      className="p-4 rounded-lg mb-6 flex items-center"
                      style={{
                        backgroundColor: darkMode
                          ? "rgba(239, 68, 68, 0.1)"
                          : "#fee2e2",
                        color: darkMode ? "#fca5a5" : "#dc2626",
                      }}
                    >
                      <svg
                        className="w-5 h-5 mr-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {error}
                    </div>
                  )}

                  {/* Table View */}
                  {!loading && !error && (
                    <div
                      className="rounded-lg overflow-hidden border"
                      style={{
                        backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                        borderColor: darkMode ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <div className="overflow-x-auto">
                        <table
                          className="w-full"
                          style={{ borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: darkMode
                                  ? "#111827"
                                  : "#f9fafb",
                                borderBottom: `1px solid ${
                                  darkMode ? "#374151" : "#e5e7eb"
                                }`,
                              }}
                            >
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "40px",
                                }}
                              ></th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                }}
                              >
                                Curriculum Tree
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "120px",
                                }}
                              >
                                Date Updated
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "120px",
                                }}
                              >
                                Date Created
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "center",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "80px",
                                }}
                              >
                                Credits
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "150px",
                                }}
                              >
                                Prerequisites
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "center",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: darkMode ? "#d1d5db" : "#374151",
                                  width: "80px",
                                }}
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {majors.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  style={{
                                    padding: "24px",
                                    textAlign: "center",
                                    color: darkMode ? "#9ca3af" : "#6b7280",
                                  }}
                                >
                                  No majors found.
                                </td>
                              </tr>
                            ) : (
                              majors.map((major) => {
                                const isExpanded = expandedMajors.has(
                                  major._id
                                );

                                return (
                                  <MajorRow
                                    key={major._id}
                                    major={major}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleMajor(major._id)}
                                    onLoadSpecialists={() =>
                                      loadSpecialistsForMajor(major._id, true)
                                    }
                                    openActionMenu={openActionMenu}
                                    onActionMenuToggle={(id) =>
                                      setOpenActionMenu(
                                        openActionMenu === id ? null : id
                                      )
                                    }
                                    onActionMenuClose={() =>
                                      setOpenActionMenu(null)
                                    }
                                    onAddSpecialist={() => {
                                      setFormData({
                                        name: "",
                                        description: "",
                                        majorId: major._id,
                                      });
                                      setShowCreateModal(true);
                                    }}
                                    onEditMajor={() =>
                                      openEditMajorModal(major)
                                    }
                                    onDeleteMajor={() =>
                                      handleDeleteMajor(major._id)
                                    }
                                    expandedSpecialists={expandedSpecialists}
                                    expandedSubjects={expandedSubjects}
                                    onToggleSpecialist={(specialistId) =>
                                      toggleSpecialist(major._id, specialistId)
                                    }
                                    onToggleSubject={(
                                      specialistId,
                                      subjectId
                                    ) =>
                                      toggleSubject(
                                        major._id,
                                        specialistId,
                                        subjectId
                                      )
                                    }
                                    onLoadSubjects={(specialistId) =>
                                      loadSubjectsForSpecialist(
                                        major._id,
                                        specialistId
                                      )
                                    }
                                    onLoadCourses={(specialistId, subjectId) =>
                                      loadCoursesForSubject(
                                        major._id,
                                        specialistId,
                                        subjectId
                                      )
                                    }
                                    onAddSubject={(specialist) =>
                                      openCreateSubjectModal(major, specialist)
                                    }
                                    onEditSubject={(specialist, subject) =>
                                      openEditSubjectModal(
                                        major,
                                        specialist,
                                        subject
                                      )
                                    }
                                    onDeleteSubject={(specialist, subject) =>
                                      handleDeleteSubject(
                                        major._id,
                                        specialist._id,
                                        subject._id
                                      )
                                    }
                                    onEditSpecialist={openEditModal}
                                    onDeleteSpecialist={handleDeleteSpecialist}
                                    onAddCourse={(subject, major, specialist) =>
                                      openCreateCourseModal(
                                        subject,
                                        major,
                                        specialist
                                      )
                                    }
                                    onEditCourse={(
                                      course,
                                      subject,
                                      major,
                                      specialist
                                    ) =>
                                      openEditCourseModal(
                                        course,
                                        subject,
                                        major,
                                        specialist
                                      )
                                    }
                                    onDeleteCourse={(
                                      course,
                                      subject,
                                      major,
                                      specialist
                                    ) =>
                                      handleDeleteCourse(
                                        course,
                                        subject,
                                        major,
                                        specialist
                                      )
                                    }
                                    onShowInfo={handleShowInfo}
                                    openInfoId={openInfoId}
                                    onCloseInfo={handleCloseInfo}
                                    // Drag and Drop props
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    draggedItem={draggedItem}
                                    dropTarget={dropTarget}
                                    isDragging={isDragging}
                                    pendingMoves={pendingMoves}
                                  />
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!loading && !error && majors.length === 0 && (
                    <div className="text-center py-12">
                      <svg
                        className="w-24 h-24 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <h3
                        className="text-xl font-semibold mb-2"
                        style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                      >
                        No curriculum found
                      </h3>
                      <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                        No majors or specialists match your search criteria
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Majors Table View */}
              {activeTab === "majors" && (
                <MajorsTable
                  onOpenMajorModal={(major) => {
                    if (major) {
                      openEditMajorModal(major);
                    } else {
                      openCreateMajorModal();
                    }
                  }}
                  onDeleteMajor={handleDeleteMajor}
                  refreshTrigger={tableRefreshTrigger}
                />
              )}

              {/* Specialists Table View */}
              {activeTab === "specialists" && (
                <SpecialistsTable
                  onOpenSpecialistModal={(specialist) => {
                    if (specialist) {
                      // Edit mode - set the specialist data directly
                      setEditingSpecialist(specialist);
                      // Handle majorId which can be string or object
                      let majorIdValue = "";
                      if (typeof specialist.majorId === "string") {
                        majorIdValue = specialist.majorId;
                      } else if (
                        specialist.majorId &&
                        typeof specialist.majorId === "object" &&
                        "_id" in specialist.majorId
                      ) {
                        majorIdValue = specialist.majorId._id;
                      }
                      setFormData({
                        name: specialist.name,
                        description: specialist.description,
                        majorId: majorIdValue,
                      });
                      setShowEditModal(true);
                    } else {
                      // Create mode
                      setFormData({ name: "", description: "", majorId: "" });
                      setShowCreateModal(true);
                    }
                  }}
                  onDeleteSpecialist={handleDeleteSpecialist}
                  refreshTrigger={tableRefreshTrigger}
                />
              )}

              {/* Subjects Table View */}
              {activeTab === "subjects" && (
                <SubjectsTable
                  onOpenSubjectModal={(subject, context) => {
                    if (subject) {
                      // Edit mode - use subject's specialistIds directly
                      const firstSpecialistId = subject.specialistIds?.[0];
                      let specialistId = "";
                      let specialistName = "";

                      if (firstSpecialistId) {
                        if (typeof firstSpecialistId === "string") {
                          specialistId = firstSpecialistId;
                        } else if (
                          typeof firstSpecialistId === "object" &&
                          "_id" in firstSpecialistId
                        ) {
                          specialistId = (firstSpecialistId as any)._id;
                          specialistName =
                            (firstSpecialistId as any).name || "";
                        }
                      }

                      setEditingSubjectId(subject._id);
                      setSubjectContext({
                        majorId: "", // Not needed for edit
                        specialistId: specialistId,
                        specialistName: specialistName,
                      });
                      setSubjectFormData({
                        name: subject.name,
                        code: subject.code || "",
                        credits: subject.credits || 3,
                        description: subject.description || "",
                        isActive: subject.isActive ?? true,
                      });
                      setShowSubjectModal(true);
                    } else if (context) {
                      // Create mode with context
                      setEditingSubjectId(null);
                      setSubjectContext({
                        majorId: "", // Will be set by specialist's major
                        specialistId: context.specialistId,
                        specialistName: context.specialistName,
                      });
                      setSubjectFormData({
                        name: "",
                        code: "",
                        credits: 3,
                        description: "",
                        isActive: true,
                      });
                      setShowSubjectModal(true);
                    } else {
                      // Create mode without context
                      setEditingSubjectId(null);
                      setSubjectContext(null);
                      setSubjectFormData({
                        name: "",
                        code: "",
                        credits: 3,
                        description: "",
                        isActive: true,
                      });
                      setShowSubjectModal(true);
                    }
                  }}
                  onDeleteSubject={async (subjectId) => {
                    // Call delete directly with just the subjectId
                    const Swal = (await import("sweetalert2")).default;
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "This action cannot be undone!",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonColor: "#dc2626",
                      cancelButtonColor: "#6b7280",
                      confirmButtonText: "Yes, delete it!",
                    });

                    if (!result.isConfirmed) return;

                    try {
                      await subjectService.deleteSubject(subjectId);
                      setTableRefreshTrigger((prev) => prev + 1);
                      await Swal.fire({
                        toast: true,
                        position: "top-end",
                        icon: "success",
                        title: "Subject deleted successfully",
                        showConfirmButton: false,
                        timer: 2000,
                      });
                    } catch (err: unknown) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : "Failed to delete subject";
                      setError(msg);
                      await Swal.fire({
                        toast: true,
                        position: "top-end",
                        icon: "error",
                        title: msg,
                        showConfirmButton: false,
                        timer: 2500,
                      });
                    }
                  }}
                  refreshTrigger={tableRefreshTrigger}
                />
              )}

              {/* Semester Management View */}
              {activeTab === "semester" && <SemesterList />}
            </div>
          </main>
        </div>

        {/* Create Specialist Modal */}
        <SpecialistModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setFormData({ name: "", description: "", majorId: "" });
          }}
          onSubmit={handleCreateSpecialist}
          title="Create New Specialist"
          formData={formData}
          onFormDataChange={setFormData}
          majors={majors}
          submitLabel="Create"
        />

        {/* Edit Specialist Modal */}
        <SpecialistModal
          isOpen={showEditModal && !!editingSpecialist}
          onClose={() => {
            setShowEditModal(false);
            setEditingSpecialist(null);
            setFormData({ name: "", description: "", majorId: "" });
          }}
          onSubmit={handleEditSpecialist}
          title="Edit Specialist"
          formData={formData}
          onFormDataChange={setFormData}
          majors={majors}
          submitLabel="Update"
        />

        <MajorModal
          isOpen={showMajorModal}
          title={editingMajorId ? "Edit Major" : "Create Major"}
          submitLabel={editingMajorId ? "Update" : "Create"}
          formData={majorFormData}
          onFormDataChange={setMajorFormData}
          onSubmit={handleMajorSubmit}
          onClose={() => {
            setShowMajorModal(false);
            setEditingMajorId(null);
            setMajorFormData({ name: "", description: "" });
          }}
        />

        <SubjectModal
          isOpen={showSubjectModal}
          title={editingSubjectId ? "Edit Subject" : "Create Subject"}
          submitLabel={editingSubjectId ? "Update" : "Create"}
          specialistId={subjectContext?.specialistId}
          specialists={majors.flatMap((major) =>
            (major.specialists || []).map((s) => ({
              _id: s._id,
              name: s.name,
            }))
          )}
          formData={subjectFormData}
          onFormDataChange={(data) => setSubjectFormData(data)}
          onSubmit={handleSubjectSubmit}
          onClose={() => {
            setShowSubjectModal(false);
            setEditingSubjectId(null);
            setSubjectContext(null);
            setSubjectFormData({
              name: "",
              code: "",
              credits: 3,
              description: "",
              isActive: true,
            });
          }}
        />

        <CourseModal
          isOpen={showCourseModal}
          title={editingCourseId ? "Edit Course" : "Create Course"}
          submitLabel={editingCourseId ? "Update" : "Create"}
          subjectName={courseContext?.subjectName}
          subjectId={courseContext?.subjectId || ""}
          formData={courseFormData}
          onFormDataChange={(data) => setCourseFormData(data)}
          onSubmit={handleCourseSubmit}
          onClose={() => {
            setShowCourseModal(false);
            setEditingCourseId(null);
            setCourseContext(null);
            setCourseFormData({
              title: "",
              description: "",
              startDate: "",
              endDate: "",
              teacherIds: [],
              status: "draft",
              isPublished: false,
              capacity: 50,
              enrollRequiresApproval: true,
              semesterId: undefined,
              logo: null,
            });
          }}
        />

        {/* Sticky Pending Changes Dialog */}
        <PendingChangesDialog
          pendingMoves={pendingMoves}
          onApply={applyPendingMoves}
          onDiscard={discardPendingMoves}
          onRemoveMove={removePendingMove}
          onUndo={undoLastMove}
          onRedo={redoLastMove}
          canUndo={pendingMoves.length > 0}
          canRedo={historyIndex >= 0 && historyIndex < moveHistory.length}
          loading={loading}
        />
      </div>
    </>
  );
};

export default Curriculum;
