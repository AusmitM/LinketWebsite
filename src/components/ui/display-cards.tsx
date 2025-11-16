"use client";

import type { ReactNode } from "react";

import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface DisplayCardProps {
  className?: string;
  icon?: ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = <Sparkles className="size-4 text-blue-300" />,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  iconClassName = "text-blue-500",
  titleClassName = "text-blue-500",
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-36 w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 bg-muted/70 px-4 py-3 backdrop-blur-sm transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-white/20 hover:bg-muted [&>*]:flex [&>*]:items-center [&>*]:gap-2",
        className
      )}
    >
      <div>
        <span
          className={cn(
            "relative inline-block rounded-full bg-blue-800 p-1",
            iconClassName
          )}
        >
          {icon}
        </span>
        <p className={cn("text-lg font-medium", titleClassName)}>{title}</p>
      </div>
      <p className="whitespace-nowrap text-lg">{description}</p>
      <p className="text-muted-foreground">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

function DisplayCards({ cards }: DisplayCardsProps) {
  const defaultCards = [
    {
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:outline before:outline-1 before:outline-border before:content-[''] hover:before:opacity-0 hover:grayscale-0 before:transition-opacity hover:before:duration-700 grayscale hover:duration-700",
    },
    {
      className:
        "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:outline before:outline-1 before:outline-border before:content-[''] hover:before:opacity-0 hover:grayscale-0 before:transition-opacity hover:before:duration-700 grayscale hover:duration-700",
    },
    {
      className:
        "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
    },
  ];

  const displayCards = cards ?? defaultCards;

  return (
    <div className="grid place-items-center opacity-100 animate-in fade-in-0 duration-700 [grid-template-areas:'stack']">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}

export { DisplayCards, type DisplayCardProps };
