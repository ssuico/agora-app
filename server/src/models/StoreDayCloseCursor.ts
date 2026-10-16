import mongoose, { Schema } from 'mongoose';

/**
 * Remembers the last Eastern calendar day whose automatic close finished
 * for every store. Dates at or before `lastClosedDate` are not closed again.
 */
const storeDayCloseCursorSchema = new Schema({
  key: { type: String, required: true, unique: true },
  lastClosedDate: { type: Date, required: true },
});

export const StoreDayCloseCursor = mongoose.model(
  'StoreDayCloseCursor',
  storeDayCloseCursorSchema
);
