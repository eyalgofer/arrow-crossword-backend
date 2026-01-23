/**
 * Configuration constants for template generation
 * Centralizes magic numbers and thresholds for easier tuning
 */

export type Size = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';

export const TEMPLATE_CONFIG = {
  PLACEMENT: {
    MAX_CONSECUTIVE_FAILURES: 200,
    ADAPTIVE_FAILURE_THRESHOLDS: {
      HIGH_COVERAGE: { threshold: 0.92, maxFailures: 50 },
      MEDIUM_COVERAGE: { threshold: 0.88, maxFailures: 100 },
      LOW_COVERAGE: { threshold: 0.85, maxFailures: 150 },
      DEFAULT: { maxFailures: 200 }
    },
    TARGET_COVERAGE: 1,
    ACCEPTABLE_COVERAGE: 0.95,
    MAX_PLACEMENT_ATTEMPTS: {
      xlarge: 100000,
      large: 80000,
      medium: 60000,
      small: 50000,
      xsmall: 40000,
      xxlarge: 100000
    },
    MAX_PLACEMENT_ATTEMPTS_PER_SLOT: {
      xlarge: 15000,
      large: 12000,
      medium: 8000,
      small: 6000,
      xsmall: 5000,
      xxlarge: 15000
    }
  },
  CROSSINGS: {
    MAX_INITIAL: 15,
    MAX_FINAL: 12,
    RELAXED_LIMIT: 15,
    PROGRESSIVE_LIMITS: [
      { ratio: 0.40, max: 10 },
      { ratio: 0.80, max: 11 },
      { ratio: 1.00, max: 12 }
    ]
  },
  COVERAGE: {
    // Adaptive coverage targets based on size
    getTargetCoverage: (size: Size): number => {
      switch (size) {
        case 'xxlarge':
        case 'xlarge':
          return 0.95;
        case 'large':
          return 0.92;
        case 'medium':
          return 0.90;
        case 'small':
          return 0.88;
        case 'xsmall':
          return 0.86;
        default:
          return 0.90;
      }
    }
  }
};
