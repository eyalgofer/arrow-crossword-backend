export type Size = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';

export const TEMPLATE_CONFIG = {
  PLACEMENT: {
    MAX_CONSECUTIVE_FAILURES: 200,
    ADAPTIVE_FAILURE_THRESHOLDS: {
      HIGH_COVERAGE: { threshold: 0.99, maxFailures: 1000 }, // Very close to 100%, allow many attempts
      MEDIUM_COVERAGE: { threshold: 0.95, maxFailures: 800 }, // Close to target, allow more attempts
      LOW_COVERAGE: { threshold: 0.90, maxFailures: 600 }, // Getting there, moderate attempts
      DEFAULT: { maxFailures: 400 } // Below 90%, increase standard limit for better coverage
    },
    TARGET_COVERAGE: 1.0, // Target 100% density - STRICT REQUIREMENT
    ACCEPTABLE_COVERAGE: 0.99, // Acceptable 99% density minimum
    MAX_PLACEMENT_ATTEMPTS: {
      xsmall: 60000,
      small: 80000,
      medium: 100000,
      large: 150000,
      xlarge: 200000,
      xxlarge: 250000
    },
    MAX_PLACEMENT_ATTEMPTS_PER_SLOT: {
      xsmall: 8000,
      small: 10000,
      medium: 12000,
      large: 20000,
      xlarge: 25000,
      xxlarge: 30000
    }
  },
  CROSSINGS: {
    MAX_INITIAL: 8,  // Reduced from 15 - too many crossings make templates unsolvable
    MAX_FINAL: 6,     // Reduced from 12 - keep templates solvable
    RELAXED_LIMIT: 8,
    PROGRESSIVE_LIMITS: [
      { ratio: 0.40, max: 5 },
      { ratio: 0.80, max: 6 },
      { ratio: 1.00, max: 6 }
    ]
  },
  COVERAGE: {
    getTargetCoverage: (size: Size): number => {
      // ALL sizes target 100% coverage
      return 1.0;
    }
  }
};
