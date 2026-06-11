import {catchErrors} from "../utils/asyncHandler";
import {OK, CREATED} from "../constants/http";
import {
    listMajorsSchema,
    majorIdSchema,
    majorSlugSchema,
    createMajorSchema,
    updateMajorSchema,
} from "../validators/major.schemas";
import {
    getMajorById,
    getMajorBySlug,
    listMajors,
    createMajor,
    updateMajorById,
    updateMajorBySlug,
    deleteMajorById,
    deleteMajorBySlug,
} from "@/services/major.service";

export const listMajorsHandler = catchErrors(async (req, res) => {
    // Validate query parameters
    const query = listMajorsSchema.parse(req.query);

    // Call service
    const result = await listMajors({
        page: query.page,
        limit: query.limit,
        search: query.search,
        name: query.name,
        slug: query.slug,
        description: query.description,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
    });

    return res.success(OK, {
        message: "Majors retrieved successfully",
        data: result.majors,
        pagination: result.pagination,
    });
});

export const getMajorByIdHandler = catchErrors(async (req, res) => {
    const majorId = majorIdSchema.parse(req.params.id);

    // Call service
    const major = await getMajorById(majorId);

    return res.success(OK, {
        message: "Major retrieved successfully",
        data: major,
    });
});

export const getMajorBySlugHandler = catchErrors(async (req, res) => {
    const majorSlug = majorSlugSchema.parse(req.params.slug);

    // Call service
    const major = await getMajorBySlug(majorSlug);

    return res.success(OK, {
        message: "Major retrieved successfully",
        data: major,
    });
});

export const createMajorHandler = catchErrors(async (req, res) => {
    const data = createMajorSchema.parse(req.body);

    // Call service
    const major = await createMajor(data);

    return res.success(CREATED, {
        message: "Major created successfully",
        data: major,
    });
});

export const updateMajorByIdHandler = catchErrors(async (req, res) => {
    const majorId = majorIdSchema.parse(req.params.id);
    const data = updateMajorSchema.parse(req.body);

    // Call service
    const major = await updateMajorById(majorId, data);

    return res.success(OK, {
        message: "Major updated successfully",
        data: major,
    });
});

export const updateMajorBySlugHandler = catchErrors(async (req, res) => {
    const slug = majorSlugSchema.parse(req.params.slug);
    const data = updateMajorSchema.parse(req.body);

    // Call service
    const major = await updateMajorBySlug(slug, data);

    return res.success(OK, {
        message: "Major updated successfully",
        data: major,
    });
});

export const deleteMajorByIdHandler = catchErrors(async (req, res) => {
    const majorId = majorIdSchema.parse(req.params.id);

    // Call service
    const major = await deleteMajorById(majorId);

    return res.success(OK, {
        message: "Major deleted successfully",
        data: major,
    });
});

export const deleteMajorBySlugHandler = catchErrors(async (req, res) => {
    const slug = majorSlugSchema.parse(req.params.slug);

    // Call service
    const major = await deleteMajorBySlug(slug);

    return res.success(OK, {
        message: "Major deleted successfully",
        data: major,
    });
});
