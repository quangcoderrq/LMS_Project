import {
  getLessonMaterials,
  getLessonMaterialsByLesson,
  getLessonMaterialById,
  createLessonMaterial,
  updateLessonMaterial,
  deleteLessonMaterial,
  uploadLessonMaterial,
  getMaterialForDownload,
  deleteFileOfMaterial,
} from "../services/lessonMaterial.service";
import { getSignedUrl } from "../utils/uploadFile";
import { catchErrors } from "../utils/asyncHandler";
import {
  LessonMaterialQuerySchema,
  LessonMaterialsByLessonSchema,
  LessonMaterialByIdSchema,
  CreateLessonMaterialSchema,
  UpdateLessonMaterialSchema,
  UploadMaterialSchema,
} from "../validators/lessonMaterial.shemas";
import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, OK } from "../constants/http";
import { Role } from "../types";
import appAssert from "@/utils/appAssert";

// Get all lesson materials with filtering
export const listAllLessonMaterialsController = catchErrors(
  async (req, res) => {
    const queryParams = LessonMaterialQuerySchema.parse(req.query);

    // Get user info from authentication middleware
    const userId = req.userId;
    const userRole = req.role;

    const result = await getLessonMaterials(queryParams, userId, userRole);

    return res.success(OK, {
      data: result.materials,
      message: "Get all lesson materials successfully",
      pagination: result.pagination,
    });
  }
);

// Get lesson materials by lesson ID
export const getLessonMaterialsByLessonController = catchErrors(
  async (req, res) => {
    const { lessonId } = req.params;

    const validatedParams = LessonMaterialsByLessonSchema.parse({ lessonId });

    // Get user info from authentication middleware
    const userId = req.userId;
    const userRole = req.role;

    const materials = await getLessonMaterialsByLesson(
      validatedParams.lessonId,
      userId,
      userRole
    );

    return res.success(OK, {
      data: materials,
      message: "Get lesson materials by lesson successfully",
    });
  }
);

// Get lesson material by ID
export const getLessonMaterialByIdController = catchErrors(async (req, res) => {
  const { id } = req.params;

  const validatedParams = LessonMaterialByIdSchema.parse({ id });

  // Get user info from authentication middleware
  const userId = req.userId;
  const userRole = req.role;

  const material = await getLessonMaterialById(
    validatedParams.id,
    userId,
    userRole
  );

  return res.success(OK, {
    data: material,
    message: "Get lesson material by id successfully",
  });
});

// Create lesson material
export const createLessonMaterialController = catchErrors(async (req, res) => {
  const data = CreateLessonMaterialSchema.parse(req.body);

  // Get user info from authentication middleware
  const userId = req.userId;
  const userRole = req.role;

  const material = await createLessonMaterial(data, userId, userRole);

  return res.success(OK, {
    data: material,
    message: "Create lesson material successfully",
  });
});

// Update lesson material
export const updateLessonMaterialController = catchErrors(async (req: any, res) => {
  const { id } = req.params;
  const validatedParams = LessonMaterialByIdSchema.parse({ id });
  const data = UpdateLessonMaterialSchema.parse(req.body);

  const file = req.file as Express.Multer.File | undefined;

  // Get user info from authentication middleware
  const userId = req.userId;
  const userRole = req.role;

  const result = await updateLessonMaterial(
    validatedParams.id,
    data,
    file,
    userId,
    userRole
  );

  return res.success(OK, {
    data: result,
    message: "Update lesson material successfully",
  });
});

// Delete lesson material
export const deleteLessonMaterialController = catchErrors(async (req, res) => {
  const { id } = req.params;
  const validatedParams = LessonMaterialByIdSchema.parse({ id });

  // Get user info from authentication middleware
  const userId = req.userId;
  const userRole = req.role;

  const material = await deleteLessonMaterial(
    validatedParams.id,
    userId,
    userRole
  );

  return res.success(OK, {
    data: material,
    message: "Delete lesson material successfully",
  });
});

// Upload lesson material with file(s) - handles both single and multiple files
export const uploadLessonMaterialController = catchErrors(
  async (req: any, res) => {
    // upload.any() puts files in req.files as an array
    // Convert to appropriate format: single file as object, multiple files as array
    let file: Express.Multer.File | Express.Multer.File[] | undefined;

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Multiple files or single file in array
      file = req.files.length === 1 ? req.files[0] : req.files;
    } else if (req.file) {
      // Single file (fallback for compatibility)
      file = req.file;
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Parse form data
    const formData = UploadMaterialSchema.parse({
      lessonId: req.body.lessonId,
      title: req.body.title,
      type: req.body.type,
    });

    // Get user info from authentication middleware
    const userId = req.userId;
    const userRole = req.role;

    const material = await uploadLessonMaterial(
      formData,
      file,
      userId,
      userRole
    );

    return res.success(OK, {
      data: material,
      message: Array.isArray(file)
        ? `Uploaded ${file.length} material(s) successfully`
        : "Upload lesson material successfully",
    });
  }
);

// Download lesson material
export const downloadLessonMaterialController = catchErrors(
  async (req, res) => {
    const { id } = req.params;
    const validatedParams = LessonMaterialByIdSchema.parse({ id });

    // Get user info from authentication middleware
    const userId = req.userId;
    const userRole = req.role;

    // First check if user has access to the material
    const material = await getLessonMaterialById(
      validatedParams.id,
      userId,
      userRole
    );

    if (!material.hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to download this material",
      });
    }

    // Get material for download
    const downloadMaterial = await getMaterialForDownload(validatedParams.id);

    // Check if material has a file (not a manual material without file)
    if (
      !downloadMaterial.key ||
      downloadMaterial.key.startsWith("manual-materials/")
    ) {
      return res.status(404).json({
        success: false,
        message: "This material does not have a file to download",
      });
    }

    const disposition = req.query.disposition === "inline" ? "inline" : "attachment";
    const signedUrl = await getSignedUrl(
      downloadMaterial.key, // 24 hours expiration
      downloadMaterial.originalName || "",
      24 * 60 * 60,
      disposition
    );

    // Prepare data object with all material info and signedUrl
    const downloadData = {
      _id: downloadMaterial._id,
      lessonId: downloadMaterial.lessonId,
      title: downloadMaterial.title,
      note: downloadMaterial.note,
      originalName: downloadMaterial.originalName,
      mimeType: downloadMaterial.mimeType,
      key: downloadMaterial.key,
      size: downloadMaterial.size,
      uploadedBy: downloadMaterial.uploadedBy,
      createdAt: downloadMaterial.createdAt,
      updatedAt: downloadMaterial.updatedAt,
      signedUrl,
    };

    return res.success(OK, {
      data: downloadData,
      message: "Material ready for download",
    });
  }
);
export const deleteLessonMaterialFile = catchErrors(async (req, res) => {
  const { id } = req.params; // id của material

  // Validate material ID
  const validatedParams = LessonMaterialByIdSchema.parse({ id });

  // Lấy thông tin người dùng từ middleware xác thực
  const userId = req.userId;
  const userRole = req.role;

  // Gọi service để xử lý logic xóa file của material
  const result = await deleteFileOfMaterial(
    validatedParams.id, // materialId
    userId,
    userRole
  );

  // Trả kết quả cho client
  return res.success(OK, {
    data: result,
    message: "Deleted file successfully",
  });
});