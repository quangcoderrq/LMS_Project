import { Types } from "mongoose";
import { NOT_FOUND, BAD_REQUEST, CONFLICT, UNAUTHORIZED, FORBIDDEN } from "../constants/http";
import EnrollmentModel from "../models/enrollment.model";
import CourseModel from "../models/course.model";
import UserModel from "../models/user.model";
import SubjectModel from "../models/subject.model";
import appAssert from "../utils/appAssert";
import { compareValue } from "../utils/bcrypt";
import { CourseStatus } from "../types/course.type";
import { EnrollmentStatus, EnrollmentRole, EnrollmentMethod } from "@/types/enrollment.type";
import { Role } from "../types/user.type";
import { createNotification } from "./notification.service";
import QuizModel from "../models/quiz.model";
import AssignmentModel from "../models/assignment.model";
import QuizAttemptModel from "../models/quizAttempt.model";
import SubmissionModel from "../models/submission.model";
import { AttemptStatus } from "../types/quizAttempt.type";
import { SubmissionStatus } from "../types/submission.type";

type ObjectIdLike = Types.ObjectId | string;

// Ensure models are registered
void CourseModel;
void UserModel;

/**
 * Yêu cầu nghiệp vụ:
 * - Lấy thông tin chi tiết của một enrollment theo ID
 * - Hiển thị thông tin student (username, email, fullname, avatar_url)
 * - Hiển thị thông tin course (title, code, description)
 * - Nếu enrollmentId không tồn tại → trả lỗi NOT_FOUND
 * 
 * Input: enrollmentId (string)
 * Output: Enrollment với thông tin student và course đã populate
 */
export const getEnrollmentById = async (enrollmentId: string) => {
  const enrollment = await EnrollmentModel.findById(enrollmentId)
    .populate("studentId", "username email fullname avatar_url")
    .populate("courseId", "title code description");

  appAssert(enrollment, NOT_FOUND, "Enrollment not found");
  return enrollment;
};

/**
 * Yêu cầu nghiệp vụ:
 * - Lấy danh sách tất cả enrollment của một student cụ thể
 * - Có thể filter theo status (pending, approved, rejected, cancelled, dropped, completed)
 * - Hỗ trợ filter theo khoảng thời gian tạo (from, to)
 * - Hỗ trợ phân trang (page, limit)
 * - Sắp xếp theo thời gian tạo mới nhất (createdAt desc)
 * - Populate thông tin course (title, code, description, category, teachers, isPublished)
 * 
 * Input: 
 * - studentId (string, bắt buộc)
 * - status (string, optional)
 * - page (number, default: 1)
 * - limit (number, default: 10)
 * 
 * Output: 
 * - enrollments: Danh sách enrollment của student
 * - pagination: { total, page, limit, totalPages }
 */
export const getStudentEnrollments = async (filters: {
  studentId: ObjectIdLike;
  status?: string;
  page?: number;
  limit?: number;
  from?: Date;
  to?: Date;
}) => {
  const { studentId, status, page = 1, limit = 10, from, to } = filters;
  const skip = (page - 1) * limit;

  const query: any = { studentId };
  if (status) {
    query.status = status;
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const [enrollments, total] = await Promise.all([
    EnrollmentModel.find(query)
      .populate("courseId", "title code description category teachers isPublished")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    EnrollmentModel.countDocuments(query),
  ]);

  return {
    enrollments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + enrollments.length < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Yêu cầu nghiệp vụ:
 * - Lấy danh sách tất cả enrollment của một khóa học cụ thể
 * - Kiểm tra course tồn tại trước → nếu không tồn tại trả lỗi NOT_FOUND
 * - Có thể filter theo status
 * - Hỗ trợ filter theo khoảng thời gian tạo (from, to)
 * - Hỗ trợ phân trang (page, limit)
 * - Sắp xếp theo thời gian tạo mới nhất (createdAt desc)
 * - Populate thông tin student (username, email, fullname, avatar_url)
 * 
 * Input:
 * - courseId (string, bắt buộc)
 * - status (string, optional)
 * - page (number, default: 1)
 * - limit (number, default: 10)
 * 
 * Output:
 * - enrollments: Danh sách enrollment của course
 * - pagination: { total, page, limit, totalPages }
 */
export const getCourseEnrollments = async (filters: {
  courseId: string;
  status?: string;
  page?: number;
  limit?: number;
  from?: Date;
  to?: Date;
}) => {
  const { courseId, status, page = 1, limit = 10, from, to } = filters;
  const skip = (page - 1) * limit;

  // Check if course exists
  const course = await CourseModel.findById(courseId);
  appAssert(course, NOT_FOUND, "Course not found");

  const query: any = { courseId };
  if (status) {
    query.status = status;
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const [enrollments, total] = await Promise.all([
    EnrollmentModel.find(query)
      .populate("studentId", "username email fullname avatar_url")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    EnrollmentModel.countDocuments(query),
  ]);

  return {
    enrollments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + enrollments.length < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Yêu cầu nghiệp vụ:
 * - Lấy toàn bộ danh sách enrollment trong hệ thống
 * - Hỗ trợ filter đa điều kiện: status, courseId, studentId
 * - Hỗ trợ filter theo khoảng thời gian tạo (from, to)
 * - Hỗ trợ phân trang (page, limit)
 * - Sắp xếp theo thời gian tạo mới nhất (createdAt desc)
 * - Populate cả thông tin student và course
 * - Phân quyền:
 *   + Admin xem được tất cả enrollment
 *   + Teacher chỉ xem enrollment thuộc khóa học mình dạy
 * 
 * Input:
 * - status (string, optional)
 * - courseId (string, optional)
 * - studentId (string, optional)
 * - page (number, default: 1)
 * - limit (number, default: 10)
 * - viewer: { role, userId } để xử lý phân quyền
 * 
 * Output:
 * - enrollments: Danh sách enrollment theo filter & quyền
 * - pagination: { total, page, limit, totalPages }
 */
export const getAllEnrollments = async (
  filters: {
    status?: string;
    courseId?: string;
    studentId?: string;
    page?: number;
    limit?: number;
    from?: Date;
    to?: Date;
  },
  viewer?: {
    role?: Role;
    userId?: ObjectIdLike;
  }
) => {
  const { status, courseId, studentId, page = 1, limit = 10, from, to } = filters;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (status) query.status = status;
  if (studentId) query.studentId = studentId;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const viewerRole = viewer?.role;
  const viewerId = viewer?.userId;

  if (viewerRole && viewerRole !== Role.ADMIN && viewerRole !== Role.TEACHER) {
    appAssert(false, FORBIDDEN, "You are not allowed to view enrollments");
  }

  if (viewerRole === Role.TEACHER) {
    appAssert(viewerId, FORBIDDEN, "Unauthorized");
    const teacherCourses = await CourseModel.find({ teacherIds: viewerId }).select("_id").lean();
    const allowedCourseIds = teacherCourses.map((course) => course._id.toString());

    if (courseId) {
      const canAccess = allowedCourseIds.includes(courseId.toString());
      appAssert(canAccess, FORBIDDEN, "You can only view enrollments for your own courses");
      query.courseId = courseId;
    } else {
      query.courseId = { $in: allowedCourseIds };
    }
  } else if (courseId) {
    query.courseId = courseId;
  }

  const [enrollments, total] = await Promise.all([
    EnrollmentModel.find(query)
      .populate("studentId", "username email fullname avatar_url")
      .populate("courseId", "title code description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    EnrollmentModel.countDocuments(query),
  ]);

  return {
    enrollments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + enrollments.length < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Yêu cầu nghiệp vụ:
 * - Tạo enrollment mới cho student vào một khóa học
 * - Kiểm tra student tồn tại → nếu không tồn tại trả lỗi NOT_FOUND
 * - Kiểm tra course tồn tại và status = ONGOING → nếu không trả lỗi NOT_FOUND hoặc BAD_REQUEST
 * - Nếu course có password → yêu cầu nhập password đúng (với method = "self")
 * - Xác định status mặc định dựa vào enrollRequiresApproval của course:
 *   + Nếu enrollRequiresApproval = true → status = "pending"
 *   + Nếu enrollRequiresApproval = false → status = "approved"
 * - Kiểm tra enrollment đã tồn tại:
 *   + Nếu status cũ = REJECTED hoặc CANCELLED → CHO PHÉP re-enroll (cập nhật lại)
 *   + Nếu status cũ = DROPPED hoặc COMPLETED → KHÔNG CHO PHÉP (phải học khóa KHÁC)
 *   + Nếu status cũ = PENDING hoặc APPROVED → KHÔNG CHO PHÉP (trả lỗi CONFLICT)
 * - Anti-spam cho Student self-enroll (method = "self"):
 *   + Cooldown: Phải đợi 30 phút sau lần re-enroll trước
 *   + Daily limit: Tối đa 5 lần enrollment/ngày cho cùng 1 course
 *   + Admin/Teacher bypass các giới hạn này
 * - Kiểm tra capacity (sức chứa) của course → nếu đầy trả lỗi BAD_REQUEST
 * - Tạo enrollment mới với các thông tin: studentId, courseId, status, role, method, note
 * 
 * Input:
 * - studentId (string, bắt buộc)
 * - courseId (string, bắt buộc)
 * - status (string, optional - mặc định theo enrollRequiresApproval)
 * - role (string, default: "student")
 * - method (string, default: "self")
 * - note (string, optional)
 * - password (string, optional - bắt buộc nếu course có password và method = "self")
 * 
 * Output: Enrollment mới được tạo (hoặc cập nhật) với thông tin student và course đã populate
 */
export const createEnrollment = async (data: {
  studentId: ObjectIdLike;
  courseId: string;
  status?: EnrollmentStatus.PENDING | EnrollmentStatus.APPROVED;
  role?: EnrollmentRole;
  method?: EnrollmentMethod;
  note?: string;
  password?: string;
}) => {
  const { studentId, courseId, role = EnrollmentRole.STUDENT, method = EnrollmentMethod.SELF, note, password } = data;

  // 1. Check student exists
  const student = await UserModel.findById(studentId);
  appAssert(student, NOT_FOUND, "Student not found");

  // 2. Check course exists and status
  const course = await CourseModel.findById(courseId);
  appAssert(course, NOT_FOUND, "Course not found");
  // Only allow enrollment for ongoing courses (not draft/deleted)
  appAssert(
    course.status === CourseStatus.ONGOING,
    BAD_REQUEST,
    "Course is not available for enrollment. Only ongoing courses can be enrolled."
  );

  //  Check prerequisites
  // Lấy thông tin Subject của course hiện tại
  const subject = await SubjectModel.findById(course.subjectId);
  appAssert(subject, NOT_FOUND, "Subject of the course not found");

  if (subject.prerequisites && subject.prerequisites.length > 0) {
    for (const prerequisiteSubjectId of subject.prerequisites) {
      // Tìm tất cả các khóa học thuộc môn điều kiện
      const prerequisiteCourses = await CourseModel.find({
        subjectId: prerequisiteSubjectId,
      }).select("_id");
      const prerequisiteCourseIds = prerequisiteCourses.map((c) => c._id);

      // Kiểm tra xem student đã hoàn thành bất kỳ khóa học nào của môn điều kiện chưa
      const hasCompletedPrerequisite = await EnrollmentModel.exists({
        studentId,
        status: EnrollmentStatus.COMPLETED,
        courseId: { $in: prerequisiteCourseIds },
      });

      if (!hasCompletedPrerequisite) {
        const prerequisiteSubject = await SubjectModel.findById(prerequisiteSubjectId);
        const subjectName = prerequisiteSubject?.name || "Unknown";
        const errorMessage = method === EnrollmentMethod.SELF
          ? `You must complete the prerequisite subject ${subjectName} before enrolling in this course.`
          : `${student.username} must complete the prerequisite subject ${subjectName} before enrolling in this course.`;
        appAssert(
          false,
          BAD_REQUEST,
          errorMessage
        );
      }
    }
  }

  // 2.1. Check password if course is password-protected
  if (course.enrollPasswordHash && method === EnrollmentMethod.SELF) {
    appAssert(password, BAD_REQUEST, "Password is required for this course");
    const isValidPassword = await compareValue(password, course.enrollPasswordHash);
    appAssert(isValidPassword, UNAUTHORIZED, "Invalid course password");
  }

  // 2.2. Determine default status based on enrollRequiresApproval
  const defaultStatus = data.status || (course.enrollRequiresApproval ? EnrollmentStatus.PENDING : EnrollmentStatus.APPROVED);
  // Validate: Only pending or approved can be set when creating enrollment
  appAssert(
    defaultStatus === EnrollmentStatus.PENDING || defaultStatus === EnrollmentStatus.APPROVED,
    BAD_REQUEST,
    "Enrollment status must be 'pending' or 'approved'"
  );
  const status = defaultStatus;

  // 3. Check existing enrollment
  const existingEnrollment = await EnrollmentModel.findOne({
    studentId,
    courseId,
  }).sort({ createdAt: -1 }); // lấy attempt mới nhất

  // Nếu đã có enrollment
  if (existingEnrollment) {
    // Chỉ cho phép re-enroll khi status = REJECTED hoặc CANCELLED
    // - REJECTED: Enrollment bị từ chối duyệt → có thể đăng ký lại
    // - CANCELLED: Student tự hủy enrollment → có thể đăng ký lại
    // 
    // KHÔNG cho phép re-enroll khi:
    // - DROPPED: Bị đánh rớt → phải đăng ký môn đó ở khóa học KHÁC
    // - COMPLETED: Đã hoàn thành → phải đăng ký môn đó ở khóa học KHÁC
    // - PENDING: Đang chờ duyệt → không cần enroll lại
    // - APPROVED: Đang học → không thể enroll lại
    const reEnrollableStatuses = [
      EnrollmentStatus.REJECTED,
      EnrollmentStatus.CANCELLED,
    ];
    const isReEnrollable = reEnrollableStatuses.includes(
      existingEnrollment.status as EnrollmentStatus
    );

    if (isReEnrollable) {
      // Anti-spam: Chỉ áp dụng cho Student self-enroll
      // Admin/Teacher tạo enrollment sẽ bypass các giới hạn này
      if (method === EnrollmentMethod.SELF) {
        // Check cooldown period: 1 phút
        const COOLDOWN_MINUTES = 1;
        const lastAttemptAt = existingEnrollment.createdAt ?? existingEnrollment.updatedAt;
        const nextAllowedTime = new Date(lastAttemptAt);
        nextAllowedTime.setMinutes(nextAllowedTime.getMinutes() + COOLDOWN_MINUTES);

        if (new Date() < nextAllowedTime) {
          const remainingSeconds = Math.ceil((nextAllowedTime.getTime() - Date.now()) / 1000);
          appAssert(
            false,
            BAD_REQUEST,
            `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before re-enrolling in this course`
          );
        }
      }

      // Verify password again for re-enrollment if needed
      if (course.enrollPasswordHash && method === EnrollmentMethod.SELF) {
        appAssert(password, BAD_REQUEST, "Password is required for this course");
        const isValidPassword = await compareValue(password, course.enrollPasswordHash);
        appAssert(isValidPassword, UNAUTHORIZED, "Invalid course password");
      }

      existingEnrollment.status = status;          // PENDING hoặc APPROVED
      existingEnrollment.role = role;
      existingEnrollment.method = method;
      existingEnrollment.note = note ?? existingEnrollment.note;

      if (status === EnrollmentStatus.PENDING) {
        existingEnrollment.respondedAt = undefined;
        existingEnrollment.respondedBy = undefined;
      } else if (status === EnrollmentStatus.APPROVED) {
        existingEnrollment.respondedAt = new Date();
        existingEnrollment.respondedBy = undefined;
      }

      existingEnrollment.updatedAt = new Date();   // cập nhật thời gian mới nhất

      await existingEnrollment.save();

      await existingEnrollment.populate([
        { path: "studentId", select: "username email fullname avatar_url" },
        { path: "courseId", select: "title code description" },
      ]);

      return existingEnrollment;
    } else {

      // Xử lý các trường hợp không được re-enroll với message cụ thể
      let errorMessage = "Already enrolled in this course";

      // Phân biệt message dựa trên method (self-enroll vs admin/teacher enroll)
      const studentName = student.username;
      const isSelfEnroll = method === EnrollmentMethod.SELF;

      if (existingEnrollment.status === EnrollmentStatus.DROPPED) {
        errorMessage = isSelfEnroll
          ? "You have been dropped from this course. Please enroll in another course offering the same subject."
          : `${studentName} has been dropped from this course. Please enroll them in another course offering the same subject.`;
      } else if (existingEnrollment.status === EnrollmentStatus.COMPLETED) {
        errorMessage = isSelfEnroll
          ? "You have already completed this course. Please enroll in another course offering the same subject."
          : `${studentName} has already completed this course. Please enroll them in another course offering the same subject.`;
      } else if (existingEnrollment.status === EnrollmentStatus.PENDING) {
        errorMessage = isSelfEnroll
          ? "Your enrollment is pending approval."
          : `${studentName}'s enrollment is pending approval.`;
      } else if (existingEnrollment.status === EnrollmentStatus.APPROVED) {
        errorMessage = isSelfEnroll
          ? "You are already enrolled in this course."
          : `${studentName} is already enrolled in this course.`;
      }

      appAssert(false, CONFLICT, errorMessage);
    }
  }
  // 4. Check course capacity
  if (course.capacity) {
    const enrolledCount = await EnrollmentModel.countDocuments({
      courseId,
      status: EnrollmentStatus.APPROVED,
    });
    appAssert(
      enrolledCount < course.capacity,
      BAD_REQUEST,
      "Course is full"
    );
  }

  // 5. Create enrollment
  const enrollment = await EnrollmentModel.create({
    studentId,
    courseId,
    status,
    role,
    method,
    note,
  });

  // Populate để trả về đầy đủ thông tin
  await enrollment.populate([
    { path: "studentId", select: "username email fullname avatar_url" },
    { path: "courseId", select: "title code description" },
  ]);

  // 6. Send notification if enrollment was created by admin/teacher (not self-enrollment)
  if (method !== EnrollmentMethod.SELF) {
    const courseData = enrollment.courseId as any;
    const studentData = enrollment.studentId as any;

    await createNotification(
      {
        title: `Enrolled in ${courseData.title}`,
        message: `You have been enrolled in the course "${courseData.title}". ${status === EnrollmentStatus.APPROVED ? "You can now access the course materials." : "Your enrollment is pending approval."}`,
        recipientType: "system",
        recipientUser: studentData._id.toString(),
      },
      new Types.ObjectId(), // System notification
      Role.ADMIN
    );
  }

  // 7. Send notification to teachers if student self-enrolls with PENDING status
  if (method === EnrollmentMethod.SELF && status === EnrollmentStatus.PENDING) {
    const courseData = enrollment.courseId as any;
    const studentData = enrollment.studentId as any;

    // Get all teachers of the course
    const courseWithTeachers = await CourseModel.findById(courseData._id).select("teacherIds");
    if (courseWithTeachers && courseWithTeachers.teacherIds && courseWithTeachers.teacherIds.length > 0) {
      // Send notification to each teacher individually
      for (const teacherId of courseWithTeachers.teacherIds) {
        await createNotification(
          {
            title: `New enrollment request for ${courseData.title}`,
            message: `${studentData.username} has requested to enroll in your course "${courseData.title}". Please review and approve.`,
            recipientType: "system",
            recipientUser: teacherId.toString(),
          },
          studentData._id,
          Role.STUDENT
        );
      }
    }
  }

  return enrollment;
};

/**
 * Yêu cầu nghiệp vụ:
 * - Cập nhật thông tin enrollment (dành cho Admin hoặc Teacher)
 * - Kiểm tra enrollment tồn tại → nếu không tồn tại trả lỗi NOT_FOUND
 * - Kiểm tra course tồn tại và chưa hết hạn:
 *   + Nếu course.status = COMPLETED → không cho phép update
 *   + Nếu course.endDate < new Date() → không cho phép update (course đã hết hạn)
 * - Cho phép cập nhật: status, role, finalGrade, note, respondedBy
 * - Tự động set timestamp khi status thay đổi:
 *   + status = "approved" hoặc "rejected" → set respondedAt = new Date()
 *   + status = "completed" → set completedAt = new Date()
 *   + status = "dropped" → set droppedAt = new Date()
 * - Nếu có respondedBy → gán vào trường respondedBy
 * 
 * Input:
 * - enrollmentId (string, bắt buộc)
 * - status (string, optional)
 * - role (string, optional)
 * - finalGrade (number, optional)
 * - note (string, optional)
 * - respondedBy (string, optional)
 * 
 * Output: Enrollment đã được cập nhật với thông tin student và course đã populate
 */
export const updateEnrollment = async (
  enrollmentId: string,
  data: {
    status?: EnrollmentStatus;
    role?: EnrollmentRole;
    finalGrade?: number;
    note?: string;
    respondedBy?: string;
  }
) => {
  // 1. Check enrollment exists
  const enrollment = await EnrollmentModel.findById(enrollmentId).populate("courseId");
  appAssert(enrollment, NOT_FOUND, "Enrollment not found");

  // Store old status for comparison
  const oldStatus = enrollment.status;

  // 2. Check course exists and not expired
  const course = enrollment.courseId as any;
  appAssert(course, NOT_FOUND, "Course not found");

  appAssert(
    course.status !== CourseStatus.COMPLETED,
    BAD_REQUEST,
    "Cannot update enrollment for a completed course"
  );

  const now = new Date();
  appAssert(
    new Date(course.endDate) > now, 
    BAD_REQUEST,
    "Cannot update enrollment for an expired course"
  );

  // 3. Update fields
  const updateData: any = {};
  if (data.status !== undefined) {
    updateData.status = data.status;

    // Tự động set timestamp khi status thay đổi
    if (data.status === EnrollmentStatus.APPROVED || data.status === EnrollmentStatus.REJECTED) {
      updateData.respondedAt = new Date();
      if (data.respondedBy) {
        updateData.respondedBy = data.respondedBy;
      }
    }
    if (data.status === EnrollmentStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    if (data.status === EnrollmentStatus.DROPPED) {
      updateData.droppedAt = new Date();
    }
  }
  if (data.role !== undefined) updateData.role = data.role;
  if (data.finalGrade !== undefined) updateData.finalGrade = data.finalGrade;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.respondedBy !== undefined) updateData.respondedBy = data.respondedBy;

  // 4. Update enrollment
  const updatedEnrollment = await EnrollmentModel.findByIdAndUpdate(
    enrollmentId,
    updateData,
    { new: true } // Return updated document
  )
    .populate("studentId", "username email fullname avatar_url")
    .populate("courseId", "title code description");

  // 5. Send notification ONLY if status actually changed
  if (data.status !== undefined && updatedEnrollment && oldStatus !== data.status) {
    const course = updatedEnrollment.courseId as any;
    const studentId = updatedEnrollment.studentId as any;

    let notificationTitle = "";
    let notificationMessage = "";

    if (data.status === EnrollmentStatus.APPROVED) {
      notificationTitle = `Enrollment approved for ${course.title}`;
      notificationMessage = `Your enrollment in course "${course.title}" has been approved. You can now access the course materials.`;
    } else if (data.status === EnrollmentStatus.REJECTED) {
      notificationTitle = `Enrollment rejected for ${course.title}`;
      notificationMessage = `Your enrollment in course "${course.title}" has been rejected.${data.note ? ` Reason: ${data.note}` : ""}`;
    } else if (data.status === EnrollmentStatus.COMPLETED) {
      notificationTitle = `Congratulations! Course completed`;
      notificationMessage = `Congratulations! You have successfully completed the course "${course.title}".`;
    }

    // Send notification if we have a message
    if (notificationTitle && notificationMessage) {
      await createNotification(
        {
          title: notificationTitle,
          message: notificationMessage,
          recipientType: "system",
          recipientUser: studentId._id.toString(),
        },
        updatedEnrollment.respondedBy as any || new Types.ObjectId(), // Use respondedBy or system
        Role.ADMIN // System notification
      );
    }
  }

  return updatedEnrollment;
};

/**
 * Yêu cầu nghiệp vụ:
 * - Student tự hủy (cancel) enrollment của mình
 * - Kiểm tra enrollment tồn tại và thuộc về student này → nếu không trả lỗi NOT_FOUND
 * - Kiểm tra course tồn tại và chưa hết hạn:
 *   + Nếu course.status = COMPLETED → không cho phép cancel
 *   + Nếu course.endDate < new Date() → không cho phép cancel (course đã hết hạn)
 * - Chỉ cho phép cancel khi status = PENDING hoặc APPROVED
 * - Không cho phép cancel khi:
 *   + Status = COMPLETED → Đã hoàn thành khóa học
 *   + Status = DROPPED → Đã bị đánh rớt bởi admin/teacher
 *   + Status = REJECTED → Đã bị từ chối duyệt
 *   + Status = CANCELLED → Đã cancel rồi
 * - Khi cancel → set status = EnrollmentStatus.CANCELLED
 * 
 * ⚠️ Phân biệt:
 * - CANCELLED: Student tự hủy enrollment (student action)
 * - DROPPED: Admin/Teacher đánh rớt student khỏi khóa học (admin/teacher action)
 * 
 * Input:
 * - enrollmentId (string, bắt buộc)
 * - studentId (string, bắt buộc - để verify ownership)
 * - status (string, chỉ nhận giá trị "cancelled")
 * 
 * Output: Enrollment đã được cập nhật với thông tin student và course đã populate
 */
export const updateSelfEnrollment = async (
  enrollmentId: string,
  studentId: ObjectIdLike,
  data: {
    status?: EnrollmentStatus.CANCELLED;
  }
) => {
  // 1. Check enrollment exists và thuộc về student này
  const enrollment = await EnrollmentModel.findOne({
    _id: enrollmentId,
    studentId,
  }).populate("courseId");
  appAssert(enrollment, NOT_FOUND, "Enrollment not found or access denied");

  // 2. Check course exists and not expired
  const course = enrollment.courseId as any;
  appAssert(course, NOT_FOUND, "Course not found");

  appAssert(
    course.status !== CourseStatus.COMPLETED,
    BAD_REQUEST,
    "Cannot cancel enrollment for a completed course"
  );

  const now = new Date();
  appAssert(
    new Date(course.endDate) > now,
    BAD_REQUEST,
    "Cannot cancel enrollment for an expired course"
  );

  // 3. Validate status - chỉ cho phép cancel khi đang PENDING hoặc APPROVED
  const cancellableStatuses = [EnrollmentStatus.PENDING, EnrollmentStatus.APPROVED];

  appAssert(
    cancellableStatuses.includes(enrollment.status),
    BAD_REQUEST,
    enrollment.status === EnrollmentStatus.COMPLETED
      ? "Cannot cancel a completed course"
      : enrollment.status === EnrollmentStatus.DROPPED
        ? "Cannot cancel this enrollment. You were dropped from this course by admin/teacher."
        : enrollment.status === EnrollmentStatus.REJECTED
          ? "Cannot cancel a rejected enrollment"
          : enrollment.status === EnrollmentStatus.CANCELLED
            ? "This enrollment is already cancelled"
            : "Cannot cancel this enrollment"
  );

  // 4. Update status to CANCELLED
  const updatedEnrollment = await EnrollmentModel.findByIdAndUpdate(
    enrollmentId,
    { status: EnrollmentStatus.CANCELLED },
    { new: true }
  )
    .populate("studentId", "username email fullname avatar_url")
    .populate("courseId", "title code description");

  return updatedEnrollment;
};

/**
 * Yêu cầu nghiệp vụ:
 * - Admin hoặc Teacher kick học sinh ra khỏi khóa học.
 * - Chỉ kick được khi status = APPROVED.
 * - Cập nhật status = DROPPED.
 * - Ghi log lý do vào note.
 * - Gửi thông báo cho học sinh.
 *
 * Input: enrollmentId, reason, userId, userRole
 * Output: Success message
 */
export const kickStudentFromCourse = async (
  enrollmentId: string,
  reason: string,
  userId: Types.ObjectId,
  userRole: Role
) => {
  // 1. Get enrollment & course
  const enrollment = await EnrollmentModel.findById(enrollmentId).populate(
    "courseId"
  );
  appAssert(enrollment, NOT_FOUND, "Enrollment not found");

  const course = enrollment.courseId as any;
  appAssert(course, NOT_FOUND, "Course not found");

  // 2. Check permission
  if (userRole !== Role.ADMIN) {
    // If not admin, must be teacher of the course
    const isTeacher = course.teacherIds.some((id: Types.ObjectId) =>
      id.equals(userId)
    );
    appAssert(
      isTeacher,
      FORBIDDEN,
      "You do not have permission to kick students from this course"
    );
  }

  // 3. Check status
  appAssert(
    enrollment.status === EnrollmentStatus.APPROVED,
    BAD_REQUEST,
    "Can only kick students who are currently enrolled (APPROVED)"
  );

  // 4. Update enrollment
  const now = new Date();
  const kicker = await UserModel.findById(userId).select("username");
  const kickerName = kicker?.username || (userRole === Role.ADMIN ? "Admin" : "Teacher")
  const updatedNote = enrollment.note
    ? `${enrollment.note}\n[Kicked by ${kickerName} at ${now.toISOString()}]: ${reason}`
    : `[Kicked by ${kickerName} at ${now.toISOString()}]: ${reason}`;

  enrollment.status = EnrollmentStatus.DROPPED;
  enrollment.droppedAt = now;
  enrollment.note = updatedNote;
  await enrollment.save();

  // 5. Send notification
  await createNotification(
    {
      title: `You have been removed from course ${course.title}`,
      message: `Reason: ${reason}`,
      recipientType: "system",
      recipientUser: enrollment.studentId.toString(),
    },
    userId,
    userRole
  );

  return {
    message: "Student kicked successfully",
    data: {
      enrollmentId: enrollment._id,
      courseId: course._id,
      studentId: enrollment.studentId,
      kickerId: userId,
      kickerName,
      reason,
      droppedAt: now,
      note: updatedNote,
    }
  };
};

/**
 * Yêu cầu nghiệp vụ:
 * - Lấy thống kê chi tiết cho một enrollment cụ thể.
 * - Chỉ dành cho khóa học đã hoàn thành (COMPLETED).
 * - Phân quyền:
 *   + Student: Chỉ xem được của chính mình.
 *   + Teacher: Chỉ xem được học sinh trong khóa mình dạy.
 *   + Admin: Xem được tất cả.
 */
export const getEnrollmentStatistics = async (params: {
  enrollmentId: string;
  userId: ObjectIdLike;
  role: Role;
}) => {
  const { enrollmentId, userId, role } = params;

  // 1. Load enrollment + populate
  const enrollment = await EnrollmentModel.findById(enrollmentId)
    .populate("studentId", "username fullname email avatar_url")
    .populate("courseId", "title code status completedAt teacherIds");

  appAssert(enrollment, NOT_FOUND, "Enrollment not found");

  const course = enrollment.courseId as any;
  const student = enrollment.studentId as any;

  // 2. Check Permission
  if (role === Role.STUDENT) {
    // Student chỉ xem được của chính mình
    const isOwner = student._id.toString() === userId.toString();
    appAssert(isOwner, FORBIDDEN, "You are not allowed to view this statistic");
  } else if (role === Role.TEACHER) {
    // Teacher chỉ xem được nếu dạy khóa này
    const isTeacherOfCourse = course.teacherIds.some((id: any) =>
      id.toString() === userId.toString()
    );
    appAssert(isTeacherOfCourse, FORBIDDEN, "You are not allowed to view this statistic");
  }
  // Admin được xem tất cả

  // 3. Check Course Status
  appAssert(
    course.status === CourseStatus.COMPLETED,
    BAD_REQUEST,
    "Course statistics are not available yet. The course must be completed first."
  );

  // 4. Fetch Detailed Data (Quizzes & Assignments)
  const courseId = course._id;
  const studentId = student._id;

  // Fetch all quizzes and assignments for the course first
  const [quizzes, assignments] = await Promise.all([
    QuizModel.find({ courseId }).select("title _id").lean(),
    AssignmentModel.find({ courseId }).select("title _id maxScore").lean(),
  ]);

  const quizIds = quizzes.map((q) => q._id);
  const assignmentIds = assignments.map((a) => a._id);

  // Then fetch attempts and submissions for these items
  const [quizAttempts, submissions] = await Promise.all([
    QuizAttemptModel.find({
      quizId: { $in: quizIds },
      studentId,
    }).lean(),
    SubmissionModel.find({
      assignmentId: { $in: assignmentIds },
      studentId,
    }).lean(),
  ]);

  // 5. Map Details
  // Map Quizzes
  const quizDetails = quizzes.map((quiz) => {
    // Find best attempt (highest score) or latest
    const attempts = quizAttempts.filter(
      (qa) => qa.quizId.toString() === quiz._id.toString() && qa.status === AttemptStatus.SUBMITTED
    );
    // Sort by score desc, then date desc
    attempts.sort((a, b) => (b.score || 0) - (a.score || 0));
    const bestAttempt = attempts[0];

    return {
      quizId: quiz._id,
      title: quiz.title,
      score: bestAttempt ? bestAttempt.score : 0,
      isCompleted: !!bestAttempt,
    };
  });

  // Map Assignments
  const assignmentDetails = assignments.map((asm) => {
    const sub = submissions.find(
      (s) => s.assignmentId.toString() === asm._id.toString() &&
        (s.status === SubmissionStatus.SUBMITTED || s.status === SubmissionStatus.GRADED)
    );

    return {
      assignmentId: asm._id,
      title: asm.title,
      score: sub?.grade || 0,
      isCompleted: !!sub,
    };
  });

  // 6. Build Response Data
  const progress = enrollment.progress || {};

  // Calculate percentages/averages for summary
  const lessonsPercent = progress.totalLessons > 0
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0;

  const attendancePercent = progress.totalAttendances > 0
    ? Math.round((progress.completedAttendances / progress.totalAttendances) * 100)
    : 0;

  const quizAvg = progress.totalQuizzes > 0
    ? Math.round((progress.totalQuizScores / progress.totalQuizzes) * 100) / 100
    : 0;

  const assignmentAvg = progress.totalAssignments > 0
    ? Math.round((progress.totalAssignmentScores / progress.totalAssignments) * 100) / 100
    : 0;

  const totalAbsent = (progress.totalAttendances || 0) - (progress.completedAttendances || 0);

  return {
    enrollmentId: enrollment._id,
    course: {
      _id: course._id,
      title: course.title,
      code: course.code,
    },
    student: {
      _id: student._id,
      fullname: student.fullname,
      username: student.username,
      email: student.email,
      avatar_url: student.avatar_url,
    },
    finalGrade: enrollment.finalGrade,
    status: enrollment.status,
    completedAt: enrollment.completedAt,
    droppedAt: enrollment.droppedAt,
    summary: {
      lessonsPercent,
      attendancePercent,
      quizAvg,
      assignmentAvg,
      totalAbsent,
    },
    details: {
      lessons: {
        total: progress.totalLessons || 0,
        completed: progress.completedLessons || 0,
      },
      quizzes: {
        total: progress.totalQuizzes || 0,
        completed: progress.completedQuizzes || 0,
        totalScore: progress.totalQuizScores || 0,
        items: quizDetails,
      },
      assignments: {
        total: progress.totalAssignments || 0,
        completed: progress.completedAssignments || 0,
        totalScore: progress.totalAssignmentScores || 0,
        items: assignmentDetails,
      },
      attendance: {
        total: progress.totalAttendances || 0,
        present: progress.completedAttendances || 0,
        absent: totalAbsent,
      },
    },
  };
};

