from typing import Literal

from flowpilot.investigations.models import Contract


class ProcedureStep(Contract):
    step_id: str
    title: str
    model_node_id: Literal[
        "bfs_bottle",
        "pickup_tube",
        "fluid_qd",
        "dj2200_valve",
        "air_cap",
        "coaxial_air",
        "valve_air",
        "bfs_air",
        "fluid_reservoir",
        "feed_tube",
        "jet_actuator",
        "service_cartridge",
        "nozzle",
        "vision_camera",
        "substrate_tray",
    ]
    camera_preset: str
    highlight: Literal["warning", "active", "none"]
    instruction: str
    caution: str
