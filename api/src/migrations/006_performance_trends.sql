-- Migration: 006_performance_trends.sql
-- Creates PerformanceMetricTrends table for historical KPI trend data
-- Additive only – does not modify existing tables

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PerformanceMetricTrends')
BEGIN
    CREATE TABLE cmdb.PerformanceMetricTrends (
        id INT IDENTITY(1,1) PRIMARY KEY,
        performanceArea NVARCHAR(100) NOT NULL,
        sourceSystem NVARCHAR(50) NOT NULL,
        metricKey NVARCHAR(50) NOT NULL,
        metricLabel NVARCHAR(100) NOT NULL,
        metricType NVARCHAR(20) NOT NULL CHECK (metricType IN ('count', 'percentage')),
        periodLabel NVARCHAR(20) NOT NULL,
        periodStartDate DATE NOT NULL,
        periodEndDate DATE NOT NULL,
        metricValue DECIMAL(18,2) NOT NULL,
        createdAt DATETIME2 DEFAULT GETUTCDATE()
    );

    CREATE INDEX idx_mt_area_source ON cmdb.PerformanceMetricTrends(performanceArea, sourceSystem);
    CREATE INDEX idx_mt_metric ON cmdb.PerformanceMetricTrends(metricKey);
    CREATE INDEX idx_mt_period ON cmdb.PerformanceMetricTrends(periodStartDate, periodEndDate);
END
GO

-- Seed historical trend data for Maintenance & Compliance / TELS
-- 5 weeks of realistic progression
IF NOT EXISTS (SELECT * FROM cmdb.PerformanceMetricTrends WHERE performanceArea = 'Maintenance & Compliance')
BEGIN
    INSERT INTO cmdb.PerformanceMetricTrends (performanceArea, sourceSystem, metricKey, metricLabel, metricType, periodLabel, periodStartDate, periodEndDate, metricValue)
    VALUES
    -- Open Work Orders (count, decreasing = improving)
    ('Maintenance & Compliance', 'TELS', 'open-wo', 'Open Work Orders', 'count', '5/16', '2026-05-10', '2026-05-16', 62),
    ('Maintenance & Compliance', 'TELS', 'open-wo', 'Open Work Orders', 'count', '5/23', '2026-05-17', '2026-05-23', 58),
    ('Maintenance & Compliance', 'TELS', 'open-wo', 'Open Work Orders', 'count', '5/30', '2026-05-24', '2026-05-30', 55),
    ('Maintenance & Compliance', 'TELS', 'open-wo', 'Open Work Orders', 'count', '6/6',  '2026-05-31', '2026-06-06', 50),
    ('Maintenance & Compliance', 'TELS', 'open-wo', 'Open Work Orders', 'count', '6/13', '2026-06-07', '2026-06-13', 46),

    -- PM Overdue (count, decreasing = improving)
    ('Maintenance & Compliance', 'TELS', 'pm-overdue', 'PM Overdue', 'count', '5/16', '2026-05-10', '2026-05-16', 73),
    ('Maintenance & Compliance', 'TELS', 'pm-overdue', 'PM Overdue', 'count', '5/23', '2026-05-17', '2026-05-23', 68),
    ('Maintenance & Compliance', 'TELS', 'pm-overdue', 'PM Overdue', 'count', '5/30', '2026-05-24', '2026-05-30', 61),
    ('Maintenance & Compliance', 'TELS', 'pm-overdue', 'PM Overdue', 'count', '6/6',  '2026-05-31', '2026-06-06', 55),
    ('Maintenance & Compliance', 'TELS', 'pm-overdue', 'PM Overdue', 'count', '6/13', '2026-06-07', '2026-06-13', 48),

    -- Mobile Adoption (percentage, increasing = improving)
    ('Maintenance & Compliance', 'TELS', 'mobile-adoption', 'Mobile Adoption', 'percentage', '5/16', '2026-05-10', '2026-05-16', 49),
    ('Maintenance & Compliance', 'TELS', 'mobile-adoption', 'Mobile Adoption', 'percentage', '5/23', '2026-05-17', '2026-05-23', 53),
    ('Maintenance & Compliance', 'TELS', 'mobile-adoption', 'Mobile Adoption', 'percentage', '5/30', '2026-05-24', '2026-05-30', 57),
    ('Maintenance & Compliance', 'TELS', 'mobile-adoption', 'Mobile Adoption', 'percentage', '6/6',  '2026-05-31', '2026-06-06', 61),
    ('Maintenance & Compliance', 'TELS', 'mobile-adoption', 'Mobile Adoption', 'percentage', '6/13', '2026-06-07', '2026-06-13', 64),

    -- Asset Tagging (percentage, increasing = improving)
    ('Maintenance & Compliance', 'TELS', 'asset-tagging', 'Asset Tagging', 'percentage', '5/16', '2026-05-10', '2026-05-16', 89),
    ('Maintenance & Compliance', 'TELS', 'asset-tagging', 'Asset Tagging', 'percentage', '5/23', '2026-05-17', '2026-05-23', 91),
    ('Maintenance & Compliance', 'TELS', 'asset-tagging', 'Asset Tagging', 'percentage', '5/30', '2026-05-24', '2026-05-30', 94),
    ('Maintenance & Compliance', 'TELS', 'asset-tagging', 'Asset Tagging', 'percentage', '6/6',  '2026-05-31', '2026-06-06', 96),
    ('Maintenance & Compliance', 'TELS', 'asset-tagging', 'Asset Tagging', 'percentage', '6/13', '2026-06-07', '2026-06-13', 98);
END
GO

PRINT 'Migration 006 complete';
