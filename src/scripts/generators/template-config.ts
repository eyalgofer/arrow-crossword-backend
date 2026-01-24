export type Size = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';

export const TEMPLATE_CONFIG = {
  PLACEMENT: {
    MAX_CONSECUTIVE_FAILURES: 200,
    ADAPTIVE_FAILURE_THRESHOLDS: {
      HIGH_COVERAGE: { threshold: 0.98, maxFailures: 1000 }, // Very close to 99%, allow many attempts
      MEDIUM_COVERAGE: { threshold: 0.95, maxFailures: 800 }, // Close to target, allow more attempts
      LOW_COVERAGE: { threshold: 0.90, maxFailures: 600 }, // Getting there, moderate attempts
      DEFAULT: { maxFailures: 400 } // Below 90%, increase standard limit for better coverage
    },
    TARGET_COVERAGE: 0.99, // Target 99% density
    ACCEPTABLE_COVERAGE: 0.7, // Acceptable 85% density for now
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
    getTargetCoverage: (size: Size): number => {
      switch (size) {
        case 'xxlarge':
        case 'xlarge':
        case 'large':
        case 'medium':          
        case 'small':
        case 'xsmall':
          return 0.99; // Target 99% density
        default:
          return 0.99;
      }
    }
  }
};
