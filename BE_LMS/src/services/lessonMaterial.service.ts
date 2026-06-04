import mongoose, { AnyConnectionBulkWriteModel } from "mongoose";
import LessonMaterialModel from "../models/lessonMaterial.model";
import LessonModel from "../models/lesson.model";
import CourseModel from "../models/course.model";
import EnrollmentModel from "../models/enrollment.model";
import {
  LessonMaterialQuerySchema,
  CreateLessonMaterialParams,
} from "../validators/lessonMaterial.shemas";
import appAssert from "../utils/appAssert";
import { CONFLICT, NOT_FOUND, FORBIDDEN, BAD_REQUEST } from "../constants/http";
import { EnrollmentStatus, Role } from "../types";
import {
  uploadFile,
  uploadFiles,
  getSignedUrl,
  removeFile,
  removeFiles,
} from "../utils/uploadFile";
import { prefixLessonMaterial } from "../utils/filePrefix";
import { v4 } from "uuid";
import { removeDirAndFiles } from "minio";
// Get all lesson materials with filtering and access control
/**
 * Yêu cầu nghiệp vụ: Liệt kê tài liệu bài học với lọc/tìm kiếm/phân trang.
 * - STUDENT: chỉ xem tài liệu thuộc các bài học của course đã ghi danh.
 * - TEACHER: xem tài liệu mình upload hoặc thuộc course mình dạy.
 * - ADMIN: xem tất cả.
 */
export const getLessonMaterials = async (
  query: any,
  userId: mongoose.Types.ObjectId,
  userRole?: Role
) => {
  const filter: any = {};
  const { from, to } = query;

  // Basic filtering
  if (query.title) {
    filter.title = { $regex: query.title, $options: "i" };
  }

    // Filter by type: need to match mimeType, originalName, or title pattern
  if (query.type) {
    const typePatterns: Record<string, any> = {
      pdf: {
        $or: [
          { mimeType: { $regex: 'pdf', $options: 'i' } },
        ]
      },
      video: {
        $or: [
          { mimeType: { $regex: 'video', $options: 'i' } },
          { mimeType: { $regex: 'mp4|avi|mov|wmv|flv|webm', $options: 'i' } },
        ]
      },
      ppt: {
        $or: [
          { mimeType: { $regex: 'powerpoint|presentation|ms-powerpoint', $options: 'i' } },
        ]
      },
      link: {
        $or: [
          { mimeType: { $regex: 'link|url', $options: 'i' } },
        ]
      }
    };

    if (typePatterns[query.type]) {
      filter.$and = filter.$and || [];
      filter.$and.push(typePatterns[query.type]);
    } else if (query.type === "other") {
      // For 'other', match files that don't match any known type
      filter.$nor = [
        { mimeType: { $regex: 'pdf|video|powerpoint|presentation|link|url', $options: 'i' } },
      ];
    }
  }

  if (query.size) {
    filter.size = query.size;
  }

  if (query.uploadedBy) {
    filter.uploadedBy = new mongoose.Types.ObjectId(query.uploadedBy);
  }

  if (query.lessonId !== undefined) {
    filter.lessonId = new mongoose.Types.ObjectId(query.lessonId);
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  // Search: Use regex search on title, note, and originalName instead of $text
  const searchConditions: any[] = [];
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: "i" };
    searchConditions.push(
      { title: searchRegex },
      { note: searchRegex },
      { originalName: searchRegex }
    );
  }

  // Access control based on user role
  const accessConditions: any[] = [];
  if (userRole === Role.STUDENT) {
    // Students can only see materials from enrolled courses
    const enrolledCourses = await EnrollmentModel.find({
      studentId: userId,
      status: EnrollmentStatus.APPROVED,
    }).select("courseId");

    const enrolledCourseIds = enrolledCourses.map(
      (enrollment) => enrollment.courseId
    );

    // Get lessons from enrolled courses
    const enrolledLessons = await LessonModel.find({
      courseId: { $in: enrolledCourseIds },
    }).select("_id");

    const enrolledLessonIds = enrolledLessons.map((lesson) => lesson._id);

    filter.lessonId = { $in: enrolledLessonIds };
  } else if (userRole === Role.TEACHER) {
    // Teachers can see their own materials and materials from their courses
    const teacherCourses = await CourseModel.find({
      teacherIds: userId,
    }).select("_id");

    const teacherCourseIds = teacherCourses.map((course) => course._id);

    // Get lessons from teacher's courses
    const teacherLessons = await LessonModel.find({
      courseId: { $in: teacherCourseIds },
    }).select("_id");

    const teacherLessonIds = teacherLessons.map((lesson) => lesson._id);

    accessConditions.push(
      { uploadedBy: new mongoose.Types.ObjectId(userId) }, // Own materials
      { lessonId: { $in: teacherLessonIds } } // Materials from teacher's courses
    );
  }
  // Admin can see everything (no additional filter)

  // Combine search and access conditions with $and
  if (searchConditions.length > 0 || accessConditions.length > 0) {
    const combinedConditions: any[] = [];

    // If both search and access conditions exist, combine them
    if (searchConditions.length > 0 && accessConditions.length > 0) {
      // User must match access AND (search condition OR search condition OR ...)
      combinedConditions.push({ $or: accessConditions });
      combinedConditions.push({ $or: searchConditions });
    } else if (searchConditions.length > 0) {
      combinedConditions.push({ $or: searchConditions });
    } else if (accessConditions.length > 0) {
      combinedConditions.push({ $or: accessConditions });
    }

    if (combinedConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push(...combinedConditions);
    }
  }

  // Pagination
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [materials, total] = await Promise.all([
    LessonMaterialModel.find(filter)
      .populate({
        path: "lessonId",
        select: "title courseId",
        // Giữ lại material ngay cả khi lessonId không tồn tại (null)
        options: { lean: true },
      })
      .populate({
        path: "uploadedBy",
        select: "firstName lastName email",
        // Giữ lại material ngay cả khi uploadedBy không tồn tại
        options: { lean: true },
      })
      .sort({ createdAt: -1 }) // Removed textScore sort since we're not using $text anymore
      .skip(skip)
      .limit(limit)
      .lean(),
    LessonMaterialModel.countDocuments(filter),
  ]);

  // Add access information for each material
  const materialsWithAccess = await Promise.all(
    materials.map(async (material) => {
      let hasAccess = false;
      let accessReason = "";

      if (userRole === Role.ADMIN) {
        hasAccess = true;
        accessReason = "admin";
      } else if (userRole === Role.TEACHER) {
        // Check if teacher uploaded this material or is instructor of the lesson's course
        const isUploader =
          material.uploadedBy && material.uploadedBy._id === userId;
        const lesson = await LessonModel.findById(material.lessonId).populate(
          "courseId",
          "teacherIds"
        );
        const isInstructor =
          lesson &&
          (lesson.courseId as any).teacherIds.includes(
            new mongoose.Types.ObjectId(userId)
          );

        if (isUploader || isInstructor) {
          hasAccess = true;
          accessReason = isUploader ? "uploader" : "instructor";
        }
      } else if (userRole === Role.STUDENT) {
        // Check if student is enrolled in the lesson's course
        const lesson = await LessonModel.findById(material.lessonId).populate(
          "courseId",
          "_id"
        );
        const enrollment = await EnrollmentModel.findOne({
          studentId: userId,
          courseId: (lesson as any).courseId._id,
          status: EnrollmentStatus.APPROVED,
        });

        if (enrollment) {
          hasAccess = true;
          accessReason = "enrolled";
        }
      }

      // Generate signed URL from key when user has access and material has a real file
      // Skip manual materials (key starts with 'manual-materials/') as they don't have files in MinIO
      let signedUrl = undefined;
      if (
        hasAccess &&
        material.key &&
        !material.key.startsWith("manual-materials/")
      ) {
        signedUrl = await getSignedUrl(
          material.key,
          material.originalName || ""
        );
      }

      return {
        ...material,
        signedUrl,
        hasAccess,
        accessReason,
      };
    })
  );

  return {
    materials: materialsWithAccess,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

// Get lesson materials by lesson ID
/**
 * Yêu cầu nghiệp vụ: Lấy tài liệu theo lessonId.
 * - STUDENT: phải ghi danh course của lesson.
 * - TEACHER: nếu là giảng viên course thì xem tất cả, nếu không chỉ xem tài liệu do mình upload.
 * - ADMIN: xem tất cả.
 */
export const getLessonMaterialsByLesson = async (
  lessonId: string,
  userId: mongoose.Types.ObjectId,
  userRole?: Role
) => {
  // Validate lessonId
  if (!mongoose.Types.ObjectId.isValid(lessonId)) {
    appAssert(false, NOT_FOUND, "Invalid lesson ID format");
  }

  // Check if lesson exists
  const lesson = await LessonModel.findById(lessonId).populate(
    "courseId",
    "title teacherIds"
  );
  appAssert(lesson, NOT_FOUND, "Lesson not found");

  // Access control based on user role
  if (userRole === Role.STUDENT) {
    // Students must be enrolled in the course
    const enrollment = await EnrollmentModel.findOne({
      studentId: userId,
      courseId: (lesson.courseId as any)._id,
      status: EnrollmentStatus.APPROVED,
    });
    appAssert(enrollment, FORBIDDEN, "Not enrolled in this course");

    // Students can see materials from enrolled courses
    const materials = await LessonMaterialModel.find({
      lessonId,
    })
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    // Generate signed URLs for materials
    const materialsWithUrls = await Promise.all(
      materials.map(async (material) => {
        let signedUrl = undefined;
        if (material.key) {
          signedUrl = await getSignedUrl(
            material.key,
            material.originalName || ""
          );
        }
        return {
          ...material,
          signedUrl,
          hasAccess: true,
          accessReason: "enrolled",
        };
      })
    );

    return materialsWithUrls;
  } else if (userRole === Role.TEACHER) {
    // Check if teacher is instructor of the course
    const isInstructor = (lesson.courseId as any).teacherIds.includes(
      new mongoose.Types.ObjectId(userId)
    );

    if (isInstructor) {
      // Instructors can see all materials
      const materials = await LessonMaterialModel.find({ lessonId })
        .populate("uploadedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      // Generate signed URLs for materials
      const materialsWithUrls = await Promise.all(
        materials.map(async (material) => {
          let signedUrl = undefined;
          if (material.key) {
            signedUrl = await getSignedUrl(
              material.key,
              material.originalName || ""
            );
          }
          return {
            ...material,
            signedUrl,
            hasAccess: true,
            accessReason: "instructor",
          };
        })
      );

      return materialsWithUrls;
    } else {
      // Non-instructor teachers can only see materials they uploaded
      const materials = await LessonMaterialModel.find({
        lessonId,
        uploadedBy: userId,
      })
        .populate("uploadedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      // Generate signed URLs for materials
      const materialsWithUrls = await Promise.all(
        materials.map(async (material) => {
          let signedUrl = undefined;
          if (material.key) {
            signedUrl = await getSignedUrl(
              material.key,
              material.originalName || ""
            );
          }
          return {
            ...material,
            signedUrl,
            hasAccess: true,
            accessReason: "uploader",
          };
        })
      );

      return materialsWithUrls;
    }
  } else if (userRole === Role.ADMIN) {
    // Admins can see all materials
    const materials = await LessonMaterialModel.find({ lessonId })
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    // Generate signed URLs for materials
    const materialsWithUrls = await Promise.all(
      materials.map(async (material) => {
        let signedUrl = undefined;
        if (material.key) {
          signedUrl = await getSignedUrl(
            material.key,
            material.originalName || ""
          );
        }
        return {
          ...material,
          signedUrl,
          hasAccess: true,
          accessReason: "admin",
        };
      })
    );

    return materialsWithUrls;
  }

  // If no user role or invalid role, return empty array
  return [];
};

// Get lesson material by ID with access control
/**
 * Yêu cầu nghiệp vụ: Lấy chi tiết tài liệu theo id, kiểm tra quyền truy cập.
 * - TEACHER: xem được nếu là giảng viên course của lesson hoặc là người upload.
 * - STUDENT: chỉ xem nếu đã ghi danh course.
 * - ADMIN: xem tất cả.
 */
export const getLessonMaterialById = async (
  id: string,
  userId: mongoose.Types.ObjectId,
  userRole?: Role
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    appAssert(false, NOT_FOUND, "Invalid material ID format");
  }

  const material = await LessonMaterialModel.findById(id)
    .populate("lessonId", "title courseId")
    .populate("uploadedBy", "firstName lastName email")
    .lean();

  appAssert(material, NOT_FOUND, "Material not found");

  // Check access permissions
  let hasAccess = false;
  let accessReason = "";

  if (userRole === Role.ADMIN) {
    hasAccess = true;
    accessReason = "admin";
  } else if (userRole === Role.TEACHER) {
    // Check if teacher uploaded this material or is instructor of the lesson's course
    const isUploader =
      material.uploadedBy && material.uploadedBy._id === userId;
    const lesson = await LessonModel.findById(material.lessonId).populate(
      "courseId",
      "teacherIds"
    );
    const isInstructor =
      lesson &&
      (lesson.courseId as any).teacherIds.includes(
        new mongoose.Types.ObjectId(userId)
      );

    if (isUploader || isInstructor) {
      hasAccess = true;
      accessReason = isUploader ? "uploader" : "instructor";
    }
  } else if (userRole === Role.STUDENT) {
    // Check if student is enrolled in the lesson's course
    const lesson = await LessonModel.findById(material.lessonId).populate(
      "courseId",
      "_id"
    );
    const enrollment = await EnrollmentModel.findOne({
      studentId: userId,
      courseId: (lesson as any).courseId._id,
      status: EnrollmentStatus.APPROVED,
    });

    if (enrollment) {
      hasAccess = true;
      accessReason = "enrolled";
    }
  }

  // If no access, only return basic info
  if (!hasAccess) {
    return {
      ...material,
      signedUrl: undefined, // Hide signed URL
      hasAccess: false,
      accessReason: "not_enrolled",
      message: "You need to enroll in this course to access the material",
    };
  }

  // Generate signed URL from key when user has access and material has a real file
  // Skip manual materials (key starts with 'manual-materials/') as they don't have files in MinIO
  let signedUrl = undefined;
  if (material.key && !material.key.startsWith("manual-materials/")) {
    signedUrl = await getSignedUrl(
      material.key,
      material.originalName || ""
    );
  }

  return {
    ...material,
    signedUrl,
    hasAccess: true,
    accessReason,
  };
};

// Create lesson material
/**
 * Yêu cầu nghiệp vụ: Tạo tài liệu mới cho một bài học.
 * - STUDENT không được phép tạo.
 * - TEACHER phải là giảng viên của course chứa lesson.
 * - Tiêu đề không trùng trong cùng một lesson.
 */
export const createLessonMaterial = async (
  data: CreateLessonMaterialParams,
  userId: mongoose.Types.ObjectId,
  userRole: Role
) => {
  // Validate lesson exists
  const lesson = await LessonModel.findById(data.lessonId).populate(
    "courseId",
    "teacherIds"
  );
  appAssert(lesson, NOT_FOUND, "Lesson not found");

  // Check if user has permission to add materials to this lesson
  if (userRole === Role.STUDENT) {
    appAssert(false, FORBIDDEN, "Students cannot create lesson materials");
  } else if (userRole === Role.TEACHER) {
    // Check if teacher is instructor of the course
    const isInstructor = (lesson.courseId as any).teacherIds.includes(
      new mongoose.Types.ObjectId(userId)
    );
    appAssert(
      isInstructor,
      FORBIDDEN,
      "Only course instructors can add materials"
    );
  }

  // Check if material with same title exists in the same lesson
  const existingMaterial = await LessonMaterialModel.exists({
    title: data.title,
    lessonId: data.lessonId,
  });
  appAssert(
    !existingMaterial,
    CONFLICT,
    "Material with this title already exists in this lesson"
  );

  // Generate a unique key if not provided
  // Format: manual-materials/{lessonId}/{uuid} if auto-generated
  // This ensures key uniqueness while distinguishing from uploaded files
  const dataWithKey = data as CreateLessonMaterialParams & {
    key?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
  };
  const materialKey =
    dataWithKey.key || `manual-materials/${data.lessonId}/${v4()}`;

  // Prepare material data with all provided fields
  const materialData: any = {
    lessonId: new mongoose.Types.ObjectId(data.lessonId),
    title: data.title,
    note: data.note,
    key: materialKey,
    uploadedBy: new mongoose.Types.ObjectId(userId),
  };

  // Add optional fields if provided
  if (dataWithKey.originalName !== undefined) {
    materialData.originalName = dataWithKey.originalName;
  }
  if (dataWithKey.mimeType !== undefined) {
    materialData.mimeType = dataWithKey.mimeType;
  }
  if (dataWithKey.size !== undefined) {
    materialData.size = dataWithKey.size;
  }

  // Create material with all provided fields
  const newMaterial = await LessonMaterialModel.create(materialData);

  return await LessonMaterialModel.findById(newMaterial._id)
    .populate("lessonId", "title courseId")
    .populate("uploadedBy", "firstName lastName email")
    .lean();
};

// Update lesson material
/**
 * Yêu cầu nghiệp vụ: Cập nhật tài liệu bài học.
 * - STUDENT không được phép.
 * - TEACHER: phải là người upload hoặc giảng viên course của lesson.
 * - Nếu đổi title, phải không trùng trong cùng lesson.
 */
export const updateLessonMaterial = async (
  id: string,
  data: Partial<CreateLessonMaterialParams>,
  file: Express.Multer.File | undefined,
  userId: mongoose.Types.ObjectId,
  userRole: Role
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    appAssert(false, NOT_FOUND, "Invalid material ID format");
  }

  const material = await LessonMaterialModel.findById(id);
  appAssert(material, NOT_FOUND, "Material not found");

  const lesson = await LessonModel.findById(material.lessonId).populate(
    "courseId",
    "teacherIds"
  );
  appAssert(lesson, NOT_FOUND, "Lesson not found");

  // Check if user has permission to update this material
  if (userRole === Role.STUDENT) {
    appAssert(false, FORBIDDEN, "Students cannot update lesson materials");
  } else if (userRole === Role.TEACHER) {
    // Check if teacher uploaded this material or is instructor of the lesson's course
    const isUploader =
      material.uploadedBy && material.uploadedBy === userId;
    const isInstructor =
      lesson &&
      (lesson.courseId as any).teacherIds.includes(
        new mongoose.Types.ObjectId(userId)
      );

    appAssert(
      isUploader || isInstructor,
      FORBIDDEN,
      "Not authorized to update this material"
    );
  }

  // If updating title, check for conflicts
  if (data.title && data.title !== material.title) {
    const existingMaterial = await LessonMaterialModel.exists({
      title: data.title,
      lessonId: material.lessonId,
      _id: { $ne: id },
    });
    appAssert(
      !existingMaterial,
      CONFLICT,
      "Material with this title already exists in this lesson"
    );
  }

  // Data is already validated in controller, no need to parse again
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.originalName !== undefined)
    updateData.originalName = data.originalName;
  if (data.mimeType !== undefined) updateData.mimeType = data.mimeType;
  if (data.size !== undefined) updateData.size = data.size;
  if (data.key !== undefined) updateData.key = data.key;

  if (file) {
    const courseIdRaw =
      (lesson.courseId as any)._id || lesson.courseId;
    const courseIdObj =
      courseIdRaw instanceof mongoose.Types.ObjectId
        ? courseIdRaw
        : new mongoose.Types.ObjectId(courseIdRaw.toString());
    const lessonIdObj =
      material.lessonId instanceof mongoose.Types.ObjectId
        ? material.lessonId
      : new mongoose.Types.ObjectId((lesson._id as any).toString());

    const uploadPrefix = prefixLessonMaterial(courseIdObj, lessonIdObj);
    const uploadResult = await uploadFile(file, uploadPrefix);

    if (
      material.key &&
      !material.key.startsWith("manual-materials/")
    ) {
      try {
        await removeFile(material.key);
      } catch (err) {
        console.error("Failed to remove old material file:", err);
      }
    }

    updateData.key = uploadResult.key;
    updateData.originalName = uploadResult.originalName;
    updateData.mimeType = uploadResult.mimeType;
    updateData.size = file.size;
  }

  const updatedMaterial = await LessonMaterialModel.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  )
    .populate("lessonId", "title courseId")
    .populate("uploadedBy", "firstName lastName email")
    .lean();

  return updatedMaterial;
};

/**
 * Yêu cầu nghiệp vụ: Xóa tài liệu bài học.
 * - STUDENT không được phép.
 * - TEACHER: phải là người upload hoặc giảng viên course của lesson.
 */
export const deleteLessonMaterial = async (
  id: string,
  userId: mongoose.Types.ObjectId,
  userRole: Role
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    appAssert(false, NOT_FOUND, "Invalid material ID format");
  }

  const material = await LessonMaterialModel.findById(id);
  appAssert(material, NOT_FOUND, "Material not found");

  // Check if user has permission to delete this material
  if (userRole === Role.STUDENT) {
    appAssert(false, FORBIDDEN, "Students cannot delete lesson materials");
  } else if (userRole === Role.TEACHER) {
    // Check if teacher uploaded this material or is instructor of the lesson's course
    const isUploader =
      material.uploadedBy && material.uploadedBy === userId;
    const lesson = await LessonModel.findById(material.lessonId).populate(
      "courseId",
      "teacherIds"
    );
    const isInstructor =
      lesson &&
      (lesson.courseId as any).teacherIds.includes(
        new mongoose.Types.ObjectId(userId)
      );

    appAssert(
      isUploader || isInstructor,
      FORBIDDEN,
      "Not authorized to delete this material"
    );
  }

  const deletedMaterial = await LessonMaterialModel.findByIdAndDelete(id);
  appAssert(deletedMaterial, NOT_FOUND, "Material not found");

  if (deletedMaterial.key && !deletedMaterial.key.startsWith("manual-materials/")) {
    try {
      await removeFile(deletedMaterial.key);
    } catch (err) {
      console.error(`Failed to remove lesson material file ${deletedMaterial.key} from MinIO:`, err);
    }
  }

  return deletedMaterial;
};

// Upload lesson material with file(s) - handles both single and multiple files
/**
 * Yêu cầu nghiệp vụ: Upload file(s) tài liệu cho một bài học.
 * - STUDENT không được phép upload.
 * - TEACHER phải là giảng viên của course chứa lesson.
 * - Không cho phép trùng tiêu đề trong cùng lesson khi upload single file.
 * - Khi upload multiple files, sẽ tự động tạo title từ tên file nếu không có.
 */
export const uploadLessonMaterial = async (
  data: any,
  file: Express.Multer.File | Express.Multer.File[] | undefined,
  userId: mongoose.Types.ObjectId,
  userRole: Role
) => {
  // Data is already validated in controller, no need to parse again
  // Validate lesson exists
  const lesson = await LessonModel.findById(data.lessonId).populate(
    "courseId",
    "teacherIds"
  );
  appAssert(lesson, NOT_FOUND, "Lesson not found");

  // Check if user has permission to add materials to this lesson
  if (userRole === Role.STUDENT) {
    appAssert(false, FORBIDDEN, "Students cannot upload lesson materials");
  } else if (userRole === Role.TEACHER) {
    // Check if teacher is instructor of the course
    const isInstructor = (lesson.courseId as any).teacherIds.includes(
      new mongoose.Types.ObjectId(userId)
    );
    appAssert(
      isInstructor,
      FORBIDDEN,
      "Only course instructors can upload materials"
    );
  }

  // Validate files
  if (!file) {
    appAssert(false, BAD_REQUEST, "No file uploaded");
  }

  // Get courseId from lesson to construct proper prefix
  const courseId = (lesson.courseId as any)._id || lesson.courseId;
  const courseIdObj =
    courseId instanceof mongoose.Types.ObjectId
      ? courseId
      : new mongoose.Types.ObjectId(courseId.toString());
  const lessonIdObj =
    lesson._id instanceof mongoose.Types.ObjectId
      ? lesson._id
      : new mongoose.Types.ObjectId((lesson._id as any).toString());

  // Create prefix string for this specific lesson
  const uploadPrefix = prefixLessonMaterial(courseIdObj, lessonIdObj);

  // Case handling: Single file vs Multiple files
  if (Array.isArray(file)) {
    // Case: Multiple files upload
    if (file.length === 0) {
      appAssert(false, BAD_REQUEST, "No files uploaded");
    }

    // Upload all files with specific prefix
    const uploadedResults = await Promise.all(
      file.map(async (f) => {
        // Upload with custom prefix string
        return await uploadFile(f, uploadPrefix);
      })
    );

    // Create materials for each file
    const materials = await Promise.all(
      uploadedResults.map(async (uploadResult, index) => {
        // Use provided title or fallback to original filename
        const materialTitle =
          data.title || uploadResult.originalName || `Material ${index + 1}`;

        // Check if material with same title exists (only if title is provided)
        if (data.title && index === 0) {
          const existingMaterial = await LessonMaterialModel.exists({
            title: materialTitle,
            lessonId: data.lessonId,
          });
          if (existingMaterial) {
            appAssert(
              false,
              CONFLICT,
              "Material with this title already exists in this lesson"
            );
          }
        }

        return await LessonMaterialModel.create({
          lessonId: new mongoose.Types.ObjectId(data.lessonId),
          title: materialTitle,
          key: uploadResult.key,
          originalName: uploadResult.originalName,
          mimeType: uploadResult.mimeType,
          size: uploadResult.size,
          uploadedBy: new mongoose.Types.ObjectId(userId),
        });
      })
    );

    // Return populated materials
    const materialIds = materials.map((m) => m._id);
    return await LessonMaterialModel.find({ _id: { $in: materialIds } })
      .populate("lessonId", "title courseId")
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: 1 })
      .lean();
  } else {
    // Case: Single file upload
    // Check if material with same title exists in the same lesson
    const existingMaterial = await LessonMaterialModel.exists({
      title: data.title,
      lessonId: data.lessonId,
    });
    appAssert(
      !existingMaterial,
      CONFLICT,
      "Material with this title already exists in this lesson"
    );

    // Upload file with prefix string
    const uploadResult = await uploadFile(file, uploadPrefix);

    // Create material with file information (only store key, originalName, mimeType, size)
    const newMaterial = await LessonMaterialModel.create({
      lessonId: new mongoose.Types.ObjectId(data.lessonId),
      title: data.title,
      key: uploadResult.key,
      originalName: uploadResult.originalName,
      mimeType: uploadResult.mimeType,
      size: file.size,
      uploadedBy: new mongoose.Types.ObjectId(userId),
    });

    return await LessonMaterialModel.findById(newMaterial._id)
      .populate("lessonId", "title courseId")
      .populate("uploadedBy", "firstName lastName email")
      .lean();
  }
};

// Get material for download (no download count tracking in original model)
/**
 * Yêu cầu nghiệp vụ: Lấy thông tin tài liệu để download.
 * - Chỉ phục vụ metadata cho quá trình tải xuống, không kiểm tra quyền ở đây.
 */
export const getMaterialForDownload = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    appAssert(false, NOT_FOUND, "Invalid material ID format");
  }

  const material = await LessonMaterialModel.findById(id)
    .populate("lessonId", "title courseId")
    .populate("uploadedBy", "firstName lastName email")
    .lean();

  appAssert(material, NOT_FOUND, "Material not found");
  return material;
};

//Delete file of material
/**
 * Yêu cầu nghiệp vụ: Xóa file của tài liệu bởi admin và giảng viên dạy bộ môn đó
 * - Xóa file trên MinIO (nếu có key)
 * - Xóa các thông tin liên quan đến file trong DB (key, originalName, mimeType, size)
 * - Giữ lại material record (chỉ xóa thông tin file)
 */
export const deleteFileOfMaterial = async (
  materialId: string,
  userId: mongoose.Types.ObjectId,
  userRole: Role
) => {
  // ✅ Validate material ID
  appAssert(
    mongoose.Types.ObjectId.isValid(materialId),
    NOT_FOUND,
    "Invalid material ID format"
  );

  // ✅ Lấy thông tin material
  const material = await LessonMaterialModel.findById(materialId);
  appAssert(material, NOT_FOUND, "Material not found");

  // ✅ Kiểm tra material có file không
  if (!material.key || material.key.startsWith("manual-materials/")) {
    appAssert(
      false,
      BAD_REQUEST,
      "This material does not have a file to delete"
    );
  }

  // ✅ Lấy thông tin lesson và kiểm tra quyền
  const lesson = await LessonModel.findById(material.lessonId).populate(
    "courseId",
    "teacherIds"
  );
  appAssert(lesson, NOT_FOUND, "Lesson not found");

  if (userRole === Role.STUDENT) {
    appAssert(false, FORBIDDEN, "Students cannot delete lesson material files");
  } else if (userRole === Role.TEACHER) {
    // Check if teacher uploaded this material or is instructor of the lesson's course
    const isUploader =
      material.uploadedBy && material.uploadedBy === userId;
    const isInstructor =
      lesson &&
      (lesson.courseId as any).teacherIds.some(
        (t: mongoose.Types.ObjectId) => t === userId
      );
    appAssert(
      isUploader || isInstructor,
      FORBIDDEN,
      "Not authorized to delete this material file"
    );
  }

  // ✅ Lưu key để xóa trên MinIO
  const fileKey = material.key;

  // ✅ Xóa file vật lý trên MinIO
  try {
    await removeFile(fileKey);
  } catch (err) {
    console.error("❌ Error removing file from MinIO:", err);
    appAssert(false, BAD_REQUEST, "Failed to delete file from storage");
  }

  // ✅ Xóa thông tin file trong MongoDB (giữ lại material record)
  const updatedMaterial = await LessonMaterialModel.findByIdAndUpdate(
    materialId,
    {
      $unset: {
        key: "",
        originalName: "",
        mimeType: "",
        size: "",
      },
    },
    { new: true }
  )
    .populate("lessonId", "title courseId")
    .populate("uploadedBy", "firstName lastName email")
    .lean();

  return {
    material: updatedMaterial,
    deletedKey: fileKey,
    message: "File deleted successfully",
  };
};
