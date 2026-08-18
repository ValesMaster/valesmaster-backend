import { Schema, model, Document } from 'mongoose';

export interface IAuditLog extends Document {
    action: string;
    module: string;
    userId?: number;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    status: 'SUCCESS' | 'FAILED';
    details?: Record<string, any>;
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    userId: { type: Number, required: true, index: true },
    username: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    details: { type: Schema.Types.Mixed },
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);