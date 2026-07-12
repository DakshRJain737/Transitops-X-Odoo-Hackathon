import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Card = forwardRef(({ className, children, hoverable = false, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'card-surface',
        hoverable && 'card-surface-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;