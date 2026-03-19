import mongoose, { Document, Schema } from 'mongoose';

export type ActivityType = 'reservation_created' | 'rating_submitted';

export interface IActivityLog extends Document {
  storeId: mongoose.Types.ObjectId;
  type: ActivityType;
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['reservation_created', 'rating_submitted'], required: true },
    actorName: { type: String, required: true, trim: true },
    actorAvatar: { type: String, default: null },
    message: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Auto-expire after 30 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
activityLogSchema.index({ storeId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
