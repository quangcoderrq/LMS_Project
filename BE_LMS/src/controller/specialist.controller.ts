import { catchErrors } from "../utils/asyncHandler";
import { OK, CREATED } from "../constants/http";
import {
  listSpecialistsSchema,
  specialistIdSchema,
  specialistSlugSchema,
  createSpecialistSchema,
  updateSpecialistSchema,
} from "../validators/specialist.schemas";
import {
  getSpecialistById,
  getSpecialistBySlug,
  listSpecialists,
  createSpecialist,
  updateSpecialistById,
  updateSpecialistBySlug,
  deleteSpecialistById,
  deleteSpecialistBySlug,
} from "@/services/specialist.service";
import mongoose from "mongoose";

export const listSpecialistsHandler = catchErrors(async (req, res) => {
  // Validate query parameters
  const query = listSpecialistsSchema.parse(req.query);

  // Call service
  const result = await listSpecialists({
    page: query.page,
    limit: query.limit,
    search: query.search,
    name: query.name,
    slug: query.slug,
    description: query.description,
    majorId: query.majorId,
    isActive: query.isActive,
    createdAt: query.createdAt,
    updatedAt: query.updatedAt,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

    return res.success(OK, {
        message: "Specialists retrieved successfully",
        data: result.specialists,
        pagination: result.pagination,
    });
});

export const getSpecialistByIdHandler = catchErrors(async (req, res) => {
  const specialistId = specialistIdSchema.parse(req.params.id);

  // Call service
  const specialist = await getSpecialistById(specialistId);

    return res.success(OK, {
        message: "Specialist retrieved successfully",
        data: specialist,
    });
});

export const getSpecialistBySlugHandler = catchErrors(async (req, res) => {
  const specialistSlug = specialistSlugSchema.parse(req.params.slug);

  // Call service
  const specialist = await getSpecialistBySlug(specialistSlug);

    return res.success(OK, {
        message: "Specialist retrieved successfully",
        data: specialist,
    });
});

export const createSpecialistHandler = catchErrors(async (req, res) => {
  const data = createSpecialistSchema.parse(req.body);

    // Call service
    const specialist = await createSpecialist({...data, majorId: data.majorId as unknown as mongoose.Types.ObjectId});

    return res.success(CREATED, {
        message: "Specialist created successfully",
        data: specialist,
    });
});

export const updateSpecialistByIdHandler = catchErrors(async (req, res) => {
  const specialistId = specialistIdSchema.parse(req.params.id);
  const data = updateSpecialistSchema.parse(req.body);

    // Call service
    const specialist = await updateSpecialistById(specialistId, {...data, majorId: data.majorId as unknown as mongoose.Types.ObjectId});

    return res.success(OK, {
        message: "Specialist updated successfully",
        data: specialist,
    });
});

export const updateSpecialistBySlugHandler = catchErrors(async (req, res) => {
  const slug = specialistSlugSchema.parse(req.params.slug);
  const data = updateSpecialistSchema.parse(req.body);

    // Call service
    const specialist = await updateSpecialistBySlug(slug, {...data, majorId: data.majorId as unknown as mongoose.Types.ObjectId});

    return res.success(OK, {
        message: "Specialist updated successfully",
        data: specialist,
    });
});

export const deleteSpecialistByIdHandler = catchErrors(async (req, res) => {
  const specialistId = specialistIdSchema.parse(req.params.id);

  // Call service
  const specialist = await deleteSpecialistById(specialistId);

    return res.success(OK, {
        message: "Specialist deleted successfully",
        data: specialist,
    });
});

export const deleteSpecialistBySlugHandler = catchErrors(async (req, res) => {
  const slug = specialistSlugSchema.parse(req.params.slug);

  // Call service
  const specialist = await deleteSpecialistBySlug(slug);

    return res.success(OK, {
        message: "Specialist deleted successfully",
        data: specialist,
    });
});
