import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: 1 | 2 | 3 | 4 | 5;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const StarRating = ({ rating, size = 'md' }: StarRatingProps) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating ? 'star-filled fill-current' : 'star-empty'
          }`}
        />
      ))}
    </div>
  );
};
