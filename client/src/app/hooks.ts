import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

/**
 * Typed Redux hooks for use throughout the application
 * 
 * Use these instead of plain `useDispatch` and `useSelector` for type safety
 */

// Use throughout your app instead of plain `useDispatch`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

// Use throughout your app instead of plain `useSelector`
export const useAppSelector = useSelector.withTypes<RootState>();
