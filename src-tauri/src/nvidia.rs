use nvml_wrapper::{enum_wrappers::device::Clock, enum_wrappers::device::TemperatureSensor, Nvml};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub name: String,
    pub temperature: u32,
    pub power_draw: f32,
    pub power_limit: f32,
    pub utilization: u32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub clock_graphics: u32,
    pub clock_memory: u32,
    pub fan_speed: Option<u32>,
}

pub struct GpuMonitor {
    nvml: Arc<Nvml>,
}

impl GpuMonitor {
    pub fn new() -> Result<Self, nvml_wrapper::error::NvmlError> {
        let nvml = Nvml::init()?;
        Ok(Self {
            nvml: Arc::new(nvml),
        })
    }

    pub fn get_info(&self) -> Result<GpuInfo, nvml_wrapper::error::NvmlError> {
        let device = self.nvml.device_by_index(0)?;

        let name = device.name().unwrap_or_else(|_| "Unknown GPU".to_string());
        let temperature = device.temperature(TemperatureSensor::Gpu).unwrap_or(0);
        let power_draw = device.power_usage().unwrap_or(0) as f32 / 1000.0; // mW to W
        let power_limit = device.power_management_limit().unwrap_or(0) as f32 / 1000.0;
        let utilization = device.utilization_rates().map(|u| u.gpu).unwrap_or(0);
        let memory_info = device.memory_info().ok();
        let memory_used = memory_info.as_ref().map(|m| m.used).unwrap_or(0);
        let memory_total = memory_info.as_ref().map(|m| m.total).unwrap_or(0);
        let clock_graphics = device.clock_info(Clock::Graphics).unwrap_or(0);
        let clock_memory = device.clock_info(Clock::Memory).unwrap_or(0);
        let fan_speed = device.fan_speed(0).ok();

        Ok(GpuInfo {
            name,
            temperature,
            power_draw,
            power_limit,
            utilization,
            memory_used,
            memory_total,
            clock_graphics,
            clock_memory,
            fan_speed,
        })
    }

    pub fn get_gpu_name(&self) -> String {
        self.nvml
            .device_by_index(0)
            .and_then(|d| d.name())
            .unwrap_or_else(|_| "Unknown GPU".to_string())
    }
}

// Global GPU monitor state
pub struct GpuMonitorState {
    pub monitor: Option<GpuMonitor>,
}

impl GpuMonitorState {
    pub fn new() -> Self {
        let monitor = GpuMonitor::new().ok();
        Self { monitor }
    }
}

pub type SharedGpuState = Arc<RwLock<GpuMonitorState>>;

pub fn create_gpu_state() -> SharedGpuState {
    Arc::new(RwLock::new(GpuMonitorState::new()))
}
