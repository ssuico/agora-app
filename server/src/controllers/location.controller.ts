import { Request, Response } from 'express';
import { Location } from '../models/Location.js';

export const getLocations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const locations = await Location.find().sort({ name: 1 });
    res.json(locations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.create(req.body);
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!location) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    await Location.findByIdAndDelete(req.params.id);
    res.json({ message: 'Location deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
