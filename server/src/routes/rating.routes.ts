import { Router, type Router as IRouter } from 'express';
import {
  createRating,
  getMyProductRatings,
  getMyRatedTransactionIds,
  getMyStoreRating,
  getProductRatingInfo,
  getRatingAggregates,
  getRatings,
} from '../controllers/rating.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const ratingRoutes: IRouter = Router();

ratingRoutes.use(authenticate);

ratingRoutes.post('/', authorize(UserRole.CUSTOMER), createRating);
ratingRoutes.get('/my-rated-transactions', getMyRatedTransactionIds);
ratingRoutes.get('/my-product-ratings', getMyProductRatings);
ratingRoutes.get('/my-store-rating', getMyStoreRating);
ratingRoutes.get('/product-rating-info', getProductRatingInfo);
ratingRoutes.get('/aggregates', getRatingAggregates);
ratingRoutes.get('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getRatings);
