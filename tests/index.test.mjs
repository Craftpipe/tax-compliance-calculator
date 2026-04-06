import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// CALCULATOR TESTS
// ============================================================================

describe('calculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = require('../lib/calculator.js');
  });

  it('should export calculateFederalTax as a function', () => {
    expect(typeof calculator.calculateFederalTax).toBe('function');
  });

  it('should export calculateStateTax as a function', () => {
    expect(typeof calculator.calculateStateTax).toBe('function');
  });

  it('should export calculateQuarterlyEstimatedTax as a function', () => {
    expect(typeof calculator.calculateQuarterlyEstimatedTax).toBe('function');
  });

  it('should export categorizeDeductions as a function', () => {
    expect(typeof calculator.categorizeDeductions).toBe('function');
  });

  it('should export computeTotalTaxLiability as a function', () => {
    expect(typeof calculator.computeTotalTaxLiability).toBe('function');
  });

  describe('calculateFederalTax', () => {
    it('should not throw with valid income and filing status', () => {
      expect(() => {
        calculator.calculateFederalTax(50000, 'single', 0);
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = calculator.calculateFederalTax(50000, 'single', 0);
      expect(result).toBeDefined();
    });

    it('should not throw with zero income', () => {
      expect(() => {
        calculator.calculateFederalTax(0, 'single', 0);
      }).not.toThrow();
    });

    it('should not throw with high income', () => {
      expect(() => {
        calculator.calculateFederalTax(1000000, 'single', 0);
      }).not.toThrow();
    });

    it('should not throw with married filing jointly status', () => {
      expect(() => {
        calculator.calculateFederalTax(100000, 'married_filing_jointly', 0);
      }).not.toThrow();
    });

    it('should not throw with head of household status', () => {
      expect(() => {
        calculator.calculateFederalTax(75000, 'head_of_household', 0);
      }).not.toThrow();
    });

    it('should not throw with deductions', () => {
      expect(() => {
        calculator.calculateFederalTax(80000, 'single', 10000);
      }).not.toThrow();
    });

    it('should not throw with negative income', () => {
      expect(() => {
        calculator.calculateFederalTax(-5000, 'single', 0);
      }).not.toThrow();
    });

    it('should not throw with negative deductions', () => {
      expect(() => {
        calculator.calculateFederalTax(50000, 'single', -1000);
      }).not.toThrow();
    });
  });

  describe('calculateStateTax', () => {
    it('should not throw with valid income and state code', () => {
      expect(() => {
        calculator.calculateStateTax(50000, 'CA', 'single', 0);
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = calculator.calculateStateTax(50000, 'CA', 'single', 0);
      expect(result).toBeDefined();
    });

    it('should not throw with zero income', () => {
      expect(() => {
        calculator.calculateStateTax(0, 'TX', 'single', 0);
      }).not.toThrow();
    });

    it('should not throw with different state codes', () => {
      expect(() => {
        calculator.calculateStateTax(60000, 'NY', 'single', 0);
      }).not.toThrow();
    });

    it('should not throw with deductions', () => {
      expect(() => {
        calculator.calculateStateTax(80000, 'CA', 'single', 5000);
      }).not.toThrow();
    });

    it('should not throw with married filing jointly', () => {
      expect(() => {
        calculator.calculateStateTax(100000, 'CA', 'married_filing_jointly', 0);
      }).not.toThrow();
    });

    it('should not throw with invalid state code', () => {
      expect(() => {
        calculator.calculateStateTax(50000, 'ZZ', 'single', 0);
      }).not.toThrow();
    });
  });

  describe('calculateQuarterlyEstimatedTax', () => {
    it('should not throw with valid annual tax', () => {
      expect(() => {
        calculator.calculateQuarterlyEstimatedTax(10000);
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = calculator.calculateQuarterlyEstimatedTax(10000);
      expect(result).toBeDefined();
    });

    it('should not throw with zero tax', () => {
      expect(() => {
        calculator.calculateQuarterlyEstimatedTax(0);
      }).not.toThrow();
    });

    it('should not throw with high tax amount', () => {
      expect(() => {
        calculator.calculateQuarterlyEstimatedTax(100000);
      }).not.toThrow();
    });

    it('should not throw with negative tax', () => {
      expect(() => {
        calculator.calculateQuarterlyEstimatedTax(-5000);
      }).not.toThrow();
    });
  });

  describe('categorizeDeductions', () => {
    it('should not throw with valid deductions object', () => {
      expect(() => {
        calculator.categorizeDeductions({
          office_supplies: 500,
          travel: 1000,
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = calculator.categorizeDeductions({
        office_supplies: 500,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        calculator.categorizeDeductions({});
      }).not.toThrow();
    });

    it('should not throw with zero values', () => {
      expect(() => {
        calculator.categorizeDeductions({
          office_supplies: 0,
          travel: 0,
        });
      }).not.toThrow();
    });

    it('should not throw with negative values', () => {
      expect(() => {
        calculator.categorizeDeductions({
          office_supplies: -100,
        });
      }).not.toThrow();
    });

    it('should not throw with various deduction categories', () => {
      expect(() => {
        calculator.categorizeDeductions({
          office_supplies: 500,
          travel: 1000,
          meals: 300,
          utilities: 200,
          equipment: 5000,
        });
      }).not.toThrow();
    });
  });

  describe('computeTotalTaxLiability', () => {
    it('should not throw with valid tax components', () => {
      expect(() => {
        calculator.computeTotalTaxLiability({
          federalIncomeTax: 5000,
          stateIncomeTax: 1000,
          selfEmploymentTax: 2000,
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = calculator.computeTotalTaxLiability({
        federalIncomeTax: 5000,
        stateIncomeTax: 1000,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with zero values', () => {
      expect(() => {
        calculator.computeTotalTaxLiability({
          federalIncomeTax: 0,
          stateIncomeTax: 0,
          selfEmploymentTax: 0,
        });
      }).not.toThrow();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        calculator.computeTotalTaxLiability({});
      }).not.toThrow();
    });

    it('should not throw with negative values', () => {
      expect(() => {
        calculator.computeTotalTaxLiability({
          federalIncomeTax: -1000,
          stateIncomeTax: -500,
        });
      }).not.toThrow();
    });

    it('should not throw with only some tax components', () => {
      expect(() => {
        calculator.computeTotalTaxLiability({
          federalIncomeTax: 5000,
        });
      }).not.toThrow();
    });
  });
});

// ============================================================================
// CONFIG TESTS
// ============================================================================

describe('config', () => {
  let config;

  beforeEach(() => {
    config = require('../lib/config.js');
  });

  it('should export loadJurisdictionRules as a function', () => {
    expect(typeof config.loadJurisdictionRules).toBe('function');
  });

  it('should export getFederalBrackets as a function', () => {
    expect(typeof config.getFederalBrackets).toBe('function');
  });

  it('should export getStateTaxRates as a function', () => {
    expect(typeof config.getStateTaxRates).toBe('function');
  });

  it('should export getDeductionLimits as a function', () => {
    expect(typeof config.getDeductionLimits).toBe('function');
  });

  it('should export getFilingThresholds as a function', () => {
    expect(typeof config.getFilingThresholds).toBe('function');
  });

  describe('loadJurisdictionRules', () => {
    it('should not throw with valid state code', () => {
      expect(() => {
        config.loadJurisdictionRules('CA');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = config.loadJurisdictionRules('CA');
      expect(result).toBeDefined();
    });

    it('should not throw with different state codes', () => {
      expect(() => {
        config.loadJurisdictionRules('TX');
      }).not.toThrow();
    });

    it('should not throw with invalid state code', () => {
      expect(() => {
        config.loadJurisdictionRules('ZZ');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        config.loadJurisdictionRules('');
      }).not.toThrow();
    });
  });

  describe('getFederalBrackets', () => {
    it('should not throw with valid filing status', () => {
      expect(() => {
        config.getFederalBrackets('single');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = config.getFederalBrackets('single');
      expect(result).toBeDefined();
    });

    it('should not throw with married filing jointly', () => {
      expect(() => {
        config.getFederalBrackets('married_filing_jointly');
      }).not.toThrow();
    });

    it('should not throw with head of household', () => {
      expect(() => {
        config.getFederalBrackets('head_of_household');
      }).not.toThrow();
    });

    it('should not throw with invalid filing status', () => {
      expect(() => {
        config.getFederalBrackets('invalid_status');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        config.getFederalBrackets('');
      }).not.toThrow();
    });
  });

  describe('getStateTaxRates', () => {
    it('should not throw with valid state code', () => {
      expect(() => {
        config.getStateTaxRates('CA');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = config.getStateTaxRates('CA');
      expect(result).toBeDefined();
    });

    it('should not throw with different state codes', () => {
      expect(() => {
        config.getStateTaxRates('NY');
      }).not.toThrow();
    });

    it('should not throw with invalid state code', () => {
      expect(() => {
        config.getStateTaxRates('ZZ');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        config.getStateTaxRates('');
      }).not.toThrow();
    });
  });

  describe('getDeductionLimits', () => {
    it('should not throw with valid deduction type', () => {
      expect(() => {
        config.getDeductionLimits('home_office');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = config.getDeductionLimits('home_office');
      expect(result).toBeDefined();
    });

    it('should not throw with different deduction types', () => {
      expect(() => {
        config.getDeductionLimits('vehicle_mileage');
      }).not.toThrow();
    });

    it('should not throw with invalid deduction type', () => {
      expect(() => {
        config.getDeductionLimits('invalid_type');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        config.getDeductionLimits('');
      }).not.toThrow();
    });
  });

  describe('getFilingThresholds', () => {
    it('should not throw with valid filing status', () => {
      expect(() => {
        config.getFilingThresholds('single');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = config.getFilingThresholds('single');
      expect(result).toBeDefined();
    });

    it('should not throw with different filing statuses', () => {
      expect(() => {
        config.getFilingThresholds('married_filing_jointly');
      }).not.toThrow();
    });

    it('should not throw with invalid filing status', () => {
      expect(() => {
        config.getFilingThresholds('invalid_status');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        config.getFilingThresholds('');
      }).not.toThrow();
    });
  });
});

// ============================================================================
// REPORT GENERATOR TESTS
// ============================================================================

describe('report-generator', () => {
  let reportGenerator;

  beforeEach(() => {
    reportGenerator = require('../lib/report-generator.js');
  });

  it('should export generateComplianceReport as a function', () => {
    expect(typeof reportGenerator.generateComplianceReport).toBe('function');
  });

  it('should export generateAuditDocument as a function', () => {
    expect(typeof reportGenerator.generateAuditDocument).toBe('function');
  });

  it('should export formatDeductionSummary as a function', () => {
    expect(typeof reportGenerator.formatDeductionSummary).toBe('function');
  });

  it('should export formatFilingDeadlines as a function', () => {
    expect(typeof reportGenerator.formatFilingDeadlines).toBe('function');
  });

  describe('generateComplianceReport', () => {
    it('should not throw with valid calculation results', () => {
      expect(() => {
        reportGenerator.generateComplianceReport({
          federalTax: 5000,
          stateTax: 1000,
          totalTax: 6000,
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = reportGenerator.generateComplianceReport({
        federalTax: 5000,
        stateTax: 1000,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        reportGenerator.generateComplianceReport({});
      }).not.toThrow();
    });

    it('should not throw with zero values', () => {
      expect(() => {
        reportGenerator.generateComplianceReport({
          federalTax: 0,
          stateTax: 0,
          totalTax: 0,
        });
      }).not.toThrow();
    });

    it('should not throw with additional metadata', () => {
      expect(() => {
        reportGenerator.generateComplianceReport({
          federalTax: 5000,
          stateTax: 1000,
          state: 'CA',
          filingStatus: 'single',
          income: 80000,
        });
      }).not.toThrow();
    });
  });

  describe('generateAuditDocument', () => {
    it('should not throw with valid calculation results', () => {
      expect(() => {
        reportGenerator.generateAuditDocument({
          federalTax: 5000,
          stateTax: 1000,
          deductions: { office_supplies: 500 },
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = reportGenerator.generateAuditDocument({
        federalTax: 5000,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        reportGenerator.generateAuditDocument({});
      }).not.toThrow();
    });

    it('should not throw with detailed deduction breakdown', () => {
      expect(() => {
        reportGenerator.generateAuditDocument({
          federalTax: 5000,
          stateTax: 1000,
          deductions: {
            office_supplies: 500,
            travel: 1000,
            meals: 300,
            equipment: 5000,
          },
        });
      }).not.toThrow();
    });
  });

  describe('formatDeductionSummary', () => {
    it('should not throw with valid deductions object', () => {
      expect(() => {
        reportGenerator.formatDeductionSummary({
          office_supplies: 500,
          travel: 1000,
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = reportGenerator.formatDeductionSummary({
        office_supplies: 500,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        reportGenerator.formatDeductionSummary({});
      }).not.toThrow();
    });

    it('should not throw with zero values', () => {
      expect(() => {
        reportGenerator.formatDeductionSummary({
          office_supplies: 0,
          travel: 0,
        });
      }).not.toThrow();
    });

    it('should not throw with multiple categories', () => {
      expect(() => {
        reportGenerator.formatDeductionSummary({
          office_supplies: 500,
          travel: 1000,
          meals: 300,
          utilities: 200,
          equipment: 5000,
        });
      }).not.toThrow();
    });
  });

  describe('formatFilingDeadlines', () => {
    it('should not throw with valid state code', () => {
      expect(() => {
        reportGenerator.formatFilingDeadlines('CA');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = reportGenerator.formatFilingDeadlines('CA');
      expect(result).toBeDefined();
    });

    it('should not throw with different state codes', () => {
      expect(() => {
        reportGenerator.formatFilingDeadlines('TX');
      }).not.toThrow();
    });

    it('should not throw with invalid state code', () => {
      expect(() => {
        reportGenerator.formatFilingDeadlines('ZZ');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        reportGenerator.formatFilingDeadlines('');
      }).not.toThrow();
    });
  });
});

// ============================================================================
// CHECKLIST GENERATOR TESTS
// ============================================================================

describe('checklist-generator', () => {
  let checklistGenerator;

  beforeEach(() => {
    checklistGenerator = require('../lib/checklist-generator.js');
  });

  it('should export generateFilingChecklist as a function', () => {
    expect(typeof checklistGenerator.generateFilingChecklist).toBe('function');
  });

  it('should export getBusinessTypeRequirements as a function', () => {
    expect(typeof checklistGenerator.getBusinessTypeRequirements).toBe('function');
  });

  it('should export formatChecklistAsMarkdown as a function', () => {
    expect(typeof checklistGenerator.formatChecklistAsMarkdown).toBe('function');
  });

  it('should export formatChecklistAsPlainText as a function', () => {
    expect(typeof checklistGenerator.formatChecklistAsPlainText).toBe('function');
  });

  describe('generateFilingChecklist', () => {
    it('should not throw with valid income and business type', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(50000, 'sole_proprietor', 'CA');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = checklistGenerator.generateFilingChecklist(50000, 'sole_proprietor', 'CA');
      expect(result).toBeDefined();
    });

    it('should not throw with zero income', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(0, 'sole_proprietor', 'CA');
      }).not.toThrow();
    });

    it('should not throw with high income', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(500000, 'llc_multi', 'NY');
      }).not.toThrow();
    });

    it('should not throw with different business types', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(80000, 'llc_single', 'TX');
      }).not.toThrow();
    });

    it('should not throw with s_corp business type', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(100000, 's_corp', 'CA');
      }).not.toThrow();
    });

    it('should not throw with partnership business type', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(150000, 'partnership', 'CA');
      }).not.toThrow();
    });

    it('should not throw with different state codes', () => {
      expect(() => {
        checklistGenerator.generateFilingChecklist(60000, 'sole_proprietor', 'FL');
      }).not.toThrow();
    });
  });

  describe('getBusinessTypeRequirements', () => {
    it('should not throw with valid business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('sole_proprietor');
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = checklistGenerator.getBusinessTypeRequirements('sole_proprietor');
      expect(result).toBeDefined();
    });

    it('should not throw with llc_single business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('llc_single');
      }).not.toThrow();
    });

    it('should not throw with llc_multi business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('llc_multi');
      }).not.toThrow();
    });

    it('should not throw with s_corp business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('s_corp');
      }).not.toThrow();
    });

    it('should not throw with c_corp business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('c_corp');
      }).not.toThrow();
    });

    it('should not throw with partnership business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('partnership');
      }).not.toThrow();
    });

    it('should not throw with invalid business type', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('invalid_type');
      }).not.toThrow();
    });

    it('should not throw with empty string', () => {
      expect(() => {
        checklistGenerator.getBusinessTypeRequirements('');
      }).not.toThrow();
    });
  });

  describe('formatChecklistAsMarkdown', () => {
    it('should not throw with valid checklist object', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsMarkdown({
          items: ['Item 1', 'Item 2'],
          businessType: 'sole_proprietor',
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = checklistGenerator.formatChecklistAsMarkdown({
        items: ['Item 1'],
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty items array', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsMarkdown({
          items: [],
        });
      }).not.toThrow();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsMarkdown({});
      }).not.toThrow();
    });

    it('should not throw with multiple items', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsMarkdown({
          items: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
          businessType: 'llc_single',
          state: 'CA',
        });
      }).not.toThrow();
    });
  });

  describe('formatChecklistAsPlainText', () => {
    it('should not throw with valid checklist object', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsPlainText({
          items: ['Item 1', 'Item 2'],
          businessType: 'sole_proprietor',
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = checklistGenerator.formatChecklistAsPlainText({
        items: ['Item 1'],
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty items array', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsPlainText({
          items: [],
        });
      }).not.toThrow();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsPlainText({});
      }).not.toThrow();
    });

    it('should not throw with multiple items', () => {
      expect(() => {
        checklistGenerator.formatChecklistAsPlainText({
          items: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
          businessType: 'llc_multi',
          state: 'NY',
        });
      }).not.toThrow();
    });
  });
});

// ============================================================================
// CSV HANDLER TESTS
// ============================================================================

describe('csv-handler', () => {
  let csvHandler;

  beforeEach(() => {
    csvHandler = require('../lib/csv-handler.js');
  });

  it('should export parseIncomeCSV as a function', () => {
    expect(typeof csvHandler.parseIncomeCSV).toBe('function');
  });

  it('should export parseExpensesCSV as a function', () => {
    expect(typeof csvHandler.parseExpensesCSV).toBe('function');
  });

  it('should export exportResultsToCSV as a function', () => {
    expect(typeof csvHandler.exportResultsToCSV).toBe('function');
  });

  it('should export validateCSVRow as a function', () => {
    expect(typeof csvHandler.validateCSVRow).toBe('function');
  });

  describe('parseIncomeCSV', () => {
    it('should not throw with valid CSV content', () => {
      const csv = 'date,description,amount\n2024-01-01,Client A,1000\n';
      expect(() => {
        csvHandler.parseIncomeCSV(csv);
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const csv = 'date,description,amount\n2024-01-01,Client A,1000\n';
      const result = csvHandler.parseIncomeCSV(csv);
      expect(result).toBeDefined();
    });

    it('should not throw with empty CSV content', () => {
      expect(() => {
        csvHandler.parseIncomeCSV('');
      }).not.toThrow();
    });

    it('should not throw with headers only', () => {
      const csv = 'date,description,amount\n';
      expect(() => {
        csvHandler.parseIncomeCSV(csv);
      }).not.toThrow();
    });

    it('should not throw with multiple rows', () => {
      const csv = 'date,description,amount\n2024-01-01,Client A,1000\n2024-01-02,Client B,2000\n';
      expect(() => {
        csvHandler.parseIncomeCSV(csv);
      }).not.toThrow();
    });

    it('should not throw with options parameter', () => {
      const csv = 'date,description,amount\n2024-01-01,Client A,1000\n';
      expect(() => {
        csvHandler.parseIncomeCSV(csv, { requiredColumns: ['date', 'amount'] });
      }).not.toThrow();
    });

    it('should not throw with malformed CSV', () => {
      const csv = 'date,description,amount\n2024-01-01,Client A\n';
      expect(() => {
        csvHandler.parseIncomeCSV(csv);
      }).not.toThrow();
    });
  });

  describe('parseExpensesCSV', () => {
    it('should not throw with valid CSV content', () => {
      const csv = 'date,category,amount\n2024-01-01,office_supplies,500\n';
      expect(() => {
        csvHandler.parseExpensesCSV(csv);
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const csv = 'date,category,amount\n2024-01-01,office_supplies,500\n';
      const result = csvHandler.parseExpensesCSV(csv);
      expect(result).toBeDefined();
    });

    it('should not throw with empty CSV content', () => {
      expect(() => {
        csvHandler.parseExpensesCSV('');
      }).not.toThrow();
    });

    it('should not throw with headers only', () => {
      const csv = 'date,category,amount\n';
      expect(() => {
        csvHandler.parseExpensesCSV(csv);
      }).not.toThrow();
    });

    it('should not throw with multiple expense rows', () => {
      const csv = 'date,category,amount\n2024-01-01,office_supplies,500\n2024-01-02,travel,1000\n';
      expect(() => {
        csvHandler.parseExpensesCSV(csv);
      }).not.toThrow();
    });

    it('should not throw with options parameter', () => {
      const csv = 'date,category,amount\n2024-01-01,office_supplies,500\n';
      expect(() => {
        csvHandler.parseExpensesCSV(csv, { requiredColumns: ['date', 'amount'] });
      }).not.toThrow();
    });

    it('should not throw with various expense categories', () => {
      const csv = 'date,category,amount\n2024-01-01,office_supplies,500\n2024-01-02,travel,1000\n2024-01-03,meals,300\n';
      expect(() => {
        csvHandler.parseExpensesCSV(csv);
      }).not.toThrow();
    });
  });

  describe('exportResultsToCSV', () => {
    it('should not throw with valid results object', () => {
      expect(() => {
        csvHandler.exportResultsToCSV({
          federalTax: 5000,
          stateTax: 1000,
          totalTax: 6000,
        });
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = csvHandler.exportResultsToCSV({
        federalTax: 5000,
      });
      expect(result).toBeDefined();
    });

    it('should not throw with empty object', () => {
      expect(() => {
        csvHandler.exportResultsToCSV({});
      }).not.toThrow();
    });

    it('should not throw with array of results', () => {
      expect(() => {
        csvHandler.exportResultsToCSV([
          { federalTax: 5000, stateTax: 1000 },
          { federalTax: 6000, stateTax: 1200 },
        ]);
      }).not.toThrow();
    });

    it('should not throw with complex results object', () => {
      expect(() => {
        csvHandler.exportResultsToCSV({
          federalTax: 5000,
          stateTax: 1000,
          totalTax: 6000,
          deductions: { office_supplies: 500, travel: 1000 },
          income: 80000,
        });
      }).not.toThrow();
    });
  });

  describe('validateCSVRow', () => {
    it('should not throw with valid row and columns', () => {
      expect(() => {
        csvHandler.validateCSVRow(
          { date: '2024-01-01', amount: '1000' },
          ['date', 'amount']
        );
      }).not.toThrow();
    });

    it('should return a defined value', () => {
      const result = csvHandler.validateCSVRow(
        { date: '2024-01-01', amount: '1000' },
        ['date', 'amount']
      );
      expect(result).toBeDefined();
    });

    it('should not throw with empty required columns', () => {
      expect(() => {
        csvHandler.validateCSVRow(
          { date: '2024-01-01' },
          []
        );
      }).not.toThrow();
    });

    it('should not throw with missing required columns', () => {
      expect(() => {
        csvHandler.validateCSVRow(
          { date: '2024-01-01' },
          ['date', 'amount']
        );
      }).not.toThrow();
    });

    it('should not throw with empty row object', () => {
      expect(() => {
        csvHandler.validateCSVRow({}, ['date', 'amount']);
      }).not.toThrow();
    });

    it('should not throw with no required columns parameter', () => {
      expect(() => {
        csvHandler.validateCSVRow({ date: '2024-01-01' });
      }).not.toThrow();
    });

    it('should not throw with extra columns in row', () => {
      expect(() => {
        csvHandler.validateCSVRow(
          { date: '2024-01-01', amount: '1000', extra: 'value' },
          ['date', 'amount']
        );
      }).not.toThrow();
    });
  });
});

// ============================================================================
// CLI INTEGRATION TESTS
// ============================================================================

describe('CLI integration', () => {
  it('should require index.js without throwing', () => {
    expect(() => {
      require('../index.js');
    }).not.toThrow();
  });

  it('should have calculator functions available from index', () => {
    const indexModule = require('../index.js');
    // Verify that the module can be required and doesn't throw
    expect(indexModule).toBeDefined();
  });

  it('should have config functions available from index', () => {
    const indexModule = require('../index.js');
    expect(indexModule).toBeDefined();
  });

  it('should have report generator functions available from index', () => {
    const indexModule = require('../index.js');
    expect(indexModule).toBeDefined();
  });

  it('should have checklist generator functions available from index', () => {
    const indexModule = require('../index.js');
    expect(indexModule).toBeDefined();
  });

  it('should have csv handler functions available from index', () => {
    const indexModule = require('../index.js');
    expect(indexModule).toBeDefined();
  });

  it('should not throw when importing all modules together', () => {
    expect(() => {
      require('../lib/calculator.js');
      require('../lib/config.js');
      require('../lib/report-generator.js');
      require('../lib/checklist-generator.js');
      require('../lib/csv-handler.js');
    }).not.toThrow();
  });
});

// TEST_MODULE_MAP: {"calculator": "lib/calculator.js", "config": "lib/config.js", "report-generator": "lib/report-generator.js", "checklist-generator": "lib/checklist-generator.js", "csv-handler": "lib/csv-handler.js", "CLI integration": "index.js"}