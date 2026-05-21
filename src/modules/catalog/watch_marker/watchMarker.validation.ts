import Joi from "joi";

export const createWatchMarkerSchema = Joi.object({
  WatchMarkerID: Joi.string().optional(),
  WatchMarkerName: Joi.string().required(),
});

export const updateWatchMarkerSchema = Joi.object({
  WatchMarkerName: Joi.string().required(),
});
