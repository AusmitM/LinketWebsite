"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type Props = Omit<ImageProps, "alt"> & {
  alt: string;
};

export default function PublicProfileImage({
  className,
  onLoad,
  onError,
  src,
  alt,
  ...props
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      onLoad={(event) => {
        setIsLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setIsLoaded(true);
        onError?.(event);
      }}
      className={cn(
        "public-profile-image-transition",
        isLoaded ? "public-profile-image-ready" : "public-profile-image-pending",
        className
      )}
    />
  );
}
