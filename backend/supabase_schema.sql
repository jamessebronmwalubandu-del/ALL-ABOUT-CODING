-- Supabase schema for image-based particle size distribution analysis
-- Stores analysis results with particles, metrics, and size classes

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main analysis results table
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    particle_count INTEGER NOT NULL CHECK (particle_count > 0),
    
    -- PSD Metrics
    d10 DOUBLE PRECISION NOT NULL CHECK (d10 >= 0),
    d50 DOUBLE PRECISION NOT NULL CHECK (d50 >= 0),
    d80 DOUBLE PRECISION NOT NULL CHECK (d80 >= 0),
    d90 DOUBLE PRECISION NOT NULL CHECK (d90 >= 0),
    p80 DOUBLE PRECISION NOT NULL CHECK (p80 >= 0),
    f80 DOUBLE PRECISION NOT NULL CHECK (f80 >= 0),
    mean DOUBLE PRECISION NOT NULL CHECK (mean >= 0),
    mode DOUBLE PRECISION NOT NULL CHECK (mode >= 0),
    span DOUBLE PRECISION NOT NULL CHECK (span >= 0),
    min_size DOUBLE PRECISION NOT NULL CHECK (min_size >= 0),
    max_size DOUBLE PRECISION NOT NULL CHECK (max_size >= 0),
    cv DOUBLE PRECISION NOT NULL CHECK (cv >= 0),
    
    -- Calibration and detection settings
    calibration JSONB NOT NULL,
    settings JSONB NOT NULL,
    
    -- Encoded processed image
    image_data_url TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Particles table: individual particle measurements
CREATE TABLE IF NOT EXISTS public.particles (
    id BIGSERIAL PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
    particle_id INTEGER NOT NULL,
    
    -- Measurements
    area DOUBLE PRECISION NOT NULL CHECK (area > 0),
    perimeter DOUBLE PRECISION NOT NULL CHECK (perimeter > 0),
    diameter DOUBLE PRECISION NOT NULL CHECK (diameter > 0),
    
    -- Geometry
    centroid JSONB NOT NULL,
    bounding_box JSONB NOT NULL,
    
    -- Shape metrics
    aspect_ratio DOUBLE PRECISION NOT NULL CHECK (aspect_ratio >= 0 AND aspect_ratio <= 1),
    circularity DOUBLE PRECISION NOT NULL CHECK (circularity >= 0 AND circularity <= 1),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(analysis_id, particle_id)
);

-- Size classes table: PSD distribution bins
CREATE TABLE IF NOT EXISTS public.size_classes (
    id BIGSERIAL PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
    
    -- Size range
    size_min DOUBLE PRECISION NOT NULL CHECK (size_min >= 0),
    size_max DOUBLE PRECISION NOT NULL CHECK (size_max >= 0),
    midpoint DOUBLE PRECISION NOT NULL CHECK (midpoint >= 0),
    
    -- Distribution values
    count INTEGER NOT NULL CHECK (count >= 0),
    frequency DOUBLE PRECISION NOT NULL CHECK (frequency >= 0 AND frequency <= 100),
    cum_retained DOUBLE PRECISION NOT NULL CHECK (cum_retained >= 0 AND cum_retained <= 100),
    cum_passing DOUBLE PRECISION NOT NULL CHECK (cum_passing >= 0 AND cum_passing <= 100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_particles_analysis_id ON public.particles(analysis_id);
CREATE INDEX idx_size_classes_analysis_id ON public.size_classes(analysis_id);
CREATE INDEX idx_analysis_results_timestamp ON public.analysis_results(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.particles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_classes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analysis_results
CREATE POLICY "Allow authenticated insert on analysis_results"
ON public.analysis_results
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated select on analysis_results"
ON public.analysis_results
FOR SELECT
TO authenticated
USING (TRUE);

-- RLS Policies for particles
CREATE POLICY "Allow authenticated insert on particles"
ON public.particles
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated select on particles"
ON public.particles
FOR SELECT
TO authenticated
USING (TRUE);

-- RLS Policies for size_classes
CREATE POLICY "Allow authenticated insert on size_classes"
ON public.size_classes
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated select on size_classes"
ON public.size_classes
FOR SELECT
TO authenticated
USING (TRUE);
