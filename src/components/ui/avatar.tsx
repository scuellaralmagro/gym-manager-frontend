import {
  forwardRef,
  useEffect,
  useState,
  type HTMLAttributes,
  type ImgHTMLAttributes,
} from "react";

import { cn } from "../../lib/utils";

// TODO: Implementar funcionalidad de subir foto de perfil y avatar con imagen

export const Avatar = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "relative flex h-20 w-20 shrink-0 overflow-hidden rounded-full",
        "bg-[#f1f5f9] text-[#0d1220] ring-1 ring-inset ring-[#e0e2e6]",
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

type AvatarImageProps = ImgHTMLAttributes<HTMLImageElement>;

export const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, onError, ...props }, ref) => {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      setFailed(false);
    }, [src]);

    if (failed || !src) return null;

    return (
      <img
        ref={ref}
        src={src}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
        className={cn("aspect-square h-full w-full object-cover", className)}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

export const AvatarFallback = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center",
      "text-lg font-medium tracking-[0.08px] text-[rgba(4,14,32,0.69)]",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";
