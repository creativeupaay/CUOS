import { Model } from 'mongoose';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { Permission } from '../../auth/models/Permission.model';
import { Client } from '../../client/models/Client.model';
import { Lead } from '../../crm/models/Lead.model';
import { Proposal } from '../../crm/models/Proposal.model';
import { BankAccount } from '../../finance/models/BankAccount.model';
import { BankTransaction } from '../../finance/models/BankTransaction.model';
import { Expense } from '../../finance/models/Expense.model';
import { FixedExpense } from '../../finance/models/FixedExpense.model';
import { FixedExpenseApproval } from '../../finance/models/FixedExpenseApproval.model';
import { Revenue } from '../../finance/models/Revenue.model';
import { Application } from '../../hiring/models/Application.model';
import { ApplicationActivity } from '../../hiring/models/ApplicationActivity.model';
import { Assignment } from '../../hiring/models/Assignment.model';
import { AssignmentSubmission } from '../../hiring/models/AssignmentSubmission.model';
import { Interview } from '../../hiring/models/Interview.model';
import { InterviewNote } from '../../hiring/models/InterviewNote.model';
import { InterviewNotification } from '../../hiring/models/InterviewNotification.model';
import { Job } from '../../hiring/models/Job.model';
import { JobTemplate } from '../../hiring/models/JobTemplate.model';
import { Offer } from '../../hiring/models/Offer.model';
import { Announcement } from '../../hrms/models/Announcement.model';
import { Attendance } from '../../hrms/models/Attendance.model';
import { Employee } from '../../hrms/models/Employee.model';
import { EmployeeDocument } from '../../hrms/models/EmployeeDocument.model';
import { Holiday } from '../../hrms/models/Holiday.model';
import { Incentive } from '../../hrms/models/Incentive.model';
import { Leave } from '../../hrms/models/Leave.model';
import { LeaveBalance } from '../../hrms/models/LeaveBalance.model';
import { Payroll } from '../../hrms/models/Payroll.model';
import { SalaryStructure } from '../../hrms/models/SalaryStructure.model';
import { Notification } from '../../notification/models/Notification.model';
import { AuditLog } from '../../overall-admin/models/AuditLog.model';
import { OrgSettings } from '../../overall-admin/models/OrgSettings.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';
import { Comment } from '../../project/models/Comment.model';
import { Credential } from '../../project/models/Credential.model';
import { DocFolder } from '../../project/models/DocFolder.model';
import { DocItem } from '../../project/models/DocItem.model';
import { Meeting } from '../../project/models/Meeting.model';
import { Note } from '../../project/models/Note.model';
import { Project } from '../../project/models/Project.model';
import { Task } from '../../project/models/Task.model';
import { TimeLog } from '../../project/models/TimeLog.model';

export type ArchiveRegistryModel = Model<Record<string, unknown>>;

const registeredModels = [
    User,
    Role,
    Permission,
    AuditLog,
    OrgSettings,
    Client,
    Lead,
    Proposal,
    Project,
    Task,
    TimeLog,
    Meeting,
    Credential,
    DocFolder,
    DocItem,
    Note,
    Comment,
    Revenue,
    Expense,
    FixedExpense,
    FixedExpenseApproval,
    BankAccount,
    BankTransaction,
    Employee,
    EmployeeDocument,
    Attendance,
    Leave,
    LeaveBalance,
    Payroll,
    SalaryStructure,
    Holiday,
    Announcement,
    Incentive,
    Job,
    JobTemplate,
    Application,
    ApplicationActivity,
    Assignment,
    AssignmentSubmission,
    Interview,
    InterviewNote,
    InterviewNotification,
    Offer,
    Partner,
    PartnerEmployee,
    Notification,
] as unknown as ArchiveRegistryModel[];

const modelRegistry = new Map(
    registeredModels.map((model) => [model.modelName, model])
);

export const getArchiveModel = (sourceModel: string): ArchiveRegistryModel => {
    const model = modelRegistry.get(sourceModel);

    if (!model) {
        throw new Error(`No archive model registered for ${sourceModel}.`);
    }

    return model;
};

export const hasArchiveModel = (sourceModel: string): boolean => modelRegistry.has(sourceModel);

export const getRegisteredArchiveModels = (): ArchiveRegistryModel[] => Array.from(modelRegistry.values());

