"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ActionItem {
  icon: React.ReactNode;
  label: string;
  isBeta?: boolean;
  onClick?: () => void;
  buttonProps?: ButtonProps;
}

export interface WorkspaceWelcomeProps {
  userName: string;
  videoThumbnail: string;
  videoTitle: string;
  videoDescription: string;
  actions: ActionItem[];
  onPlayVideo?: () => void;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  },
};

export const WorkspaceWelcome = React.forwardRef<
  HTMLDivElement,
  WorkspaceWelcomeProps
>(
  (
    {
      userName,
      videoThumbnail,
      videoTitle,
      videoDescription,
      actions,
      onPlayVideo,
      className,
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "flex w-full max-w-2xl flex-col items-center gap-8 rounded-lg p-4",
          className
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          variants={itemVariants}
        >
          Welcome to your workspace, {userName}! 👋
        </motion.h1>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          variants={itemVariants}
        >
          {actions.map((action, index) => (
            <Button
              key={`${action.label}-${index}`}
              variant="outline"
              className="flex items-center gap-2"
              onClick={action.onClick}
              {...action.buttonProps}
            >
              {action.icon}
              <span className="font-medium">{action.label}</span>
              {action.isBeta && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  BETA
                </Badge>
              )}
            </Button>
          ))}
        </motion.div>

        <motion.div
          className="group relative w-full cursor-pointer overflow-hidden rounded-xl shadow-lg"
          onClick={onPlayVideo}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <img
            src={videoThumbnail}
            alt={videoTitle}
            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 text-white">
            <h3 className="text-lg font-bold">{videoTitle}</h3>
            <p className="text-sm text-white/80">{videoDescription}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-16 w-16 text-white/80 transition-all duration-300 group-hover:scale-110 group-hover:text-white" />
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

WorkspaceWelcome.displayName = "WorkspaceWelcome";
