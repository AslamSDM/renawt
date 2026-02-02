"use client";

import React from "react";

interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  size = "md",
  showLabel = false,
  className = "",
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden
          ${heights[size]}
        `}
      >
        <div
          className={`
            bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300 ease-out
            ${heights[size]}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

interface StepsProgressProps {
  steps: Array<{
    id: string;
    label: string;
  }>;
  currentStep: string;
  className?: string;
}

export const StepsProgress: React.FC<StepsProgressProps> = ({
  steps,
  currentStep,
  className = "",
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${
                      isCompleted
                        ? "bg-blue-600 text-white"
                        : isCurrent
                          ? "bg-blue-100 text-blue-600 border-2 border-blue-600 dark:bg-blue-900 dark:text-blue-400"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium
                    ${
                      isCompleted || isCurrent
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-4 -mt-6
                    ${
                      index < currentIndex
                        ? "bg-blue-600"
                        : "bg-gray-200 dark:bg-gray-700"
                    }
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Progress;
