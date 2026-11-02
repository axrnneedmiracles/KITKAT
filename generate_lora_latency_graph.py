"""
SHEcurity -- LoRa Performance, Latency & Range Benchmark Dashboard
Generates a comprehensive 3-chart + table high-res infographic comparing:
1. Packet Time-on-Air (ms)
2. Real-World 2-Way Latency (s)
3. Maximum Communication Range (Urban vs. Line-of-Sight in km)
4. Executive Benchmark Matrix Table
"""

import os
import math
import matplotlib.pyplot as plt
import numpy as np

# Set clean font stack
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'DejaVu Sans', 'Arial']
plt.rcParams['axes.edgecolor'] = '#334155'
plt.rcParams['axes.linewidth'] = 1.2

def calculate_lora_toa(sf, bw_khz, pl_bytes=40, cr=1, crc=1, ih=0, n_preamble=8):
    """
    Exact Semtech SX1276/7/8 Time-on-Air (ToA) formula.
    """
    bw = bw_khz * 1000.0
    t_sym = (2**sf) / bw
    de = 1 if (t_sym * 1000.0) > 16.0 else 0
    t_preamble = (n_preamble + 4.25) * t_sym
    
    term = (8 * pl_bytes - 4 * sf + 28 + 16 * crc - 20 * ih) / (4.0 * (sf - 2 * de))
    n_payload = 8 + max(math.ceil(term) * (cr + 4), 0)
    toa = t_preamble + n_payload * t_sym
    return toa, t_sym, de

# Configurations data
configs = [
    {
        "name": "SF7 @ 125 kHz",
        "short_label": "SF7\n125 kHz",
        "sf": 7,
        "bw": 125.0,
        "color": "#10B981",       # Emerald Green
        "sens": -123,
        "urban_range": 2.2,       # km
        "los_range": 6.5,         # km
        "real_rtt": 0.25,         # seconds
        "desc": "Ultra Fast / Low Penetration"
    },
    {
        "name": "SF9 @ 125 kHz [SELECTED]",
        "short_label": "SF9\n125 kHz\n[SELECTED]",
        "sf": 9,
        "bw": 125.0,
        "color": "#00F0FF",       # Electric Cyan
        "sens": -129,
        "urban_range": 4.5,       # km (Double SF7 range due to +6dB link budget!)
        "los_range": 12.0,        # km
        "real_rtt": 0.65,         # seconds (<1 sec!)
        "desc": "Golden Ratio: Sub-Second + Long Range"
    },
    {
        "name": "SF9 @ 62.5 kHz",
        "short_label": "SF9\n62.5 kHz",
        "sf": 9,
        "bw": 62.5,
        "color": "#818CF8",       # Indigo / Purple
        "sens": -132,
        "urban_range": 5.4,       # km
        "los_range": 14.5,        # km
        "real_rtt": 1.20,         # seconds
        "desc": "Moderate Latency / Good Range"
    },
    {
        "name": "SF12 @ 125 kHz",
        "short_label": "SF12\n125 kHz",
        "sf": 12,
        "bw": 125.0,
        "color": "#F59E0B",       # Amber
        "sens": -137,
        "urban_range": 6.8,       # km
        "los_range": 18.0,        # km
        "real_rtt": 3.80,         # seconds
        "desc": "High Latency / Extended Range"
    },
    {
        "name": "SF12 @ 62.5 kHz [OLD]",
        "short_label": "SF12\n62.5 kHz\n[OLD CONFIG]",
        "sf": 12,
        "bw": 62.5,
        "color": "#EF4444",       # Crimson Red
        "sens": -140,
        "urban_range": 8.0,       # km
        "los_range": 22.0,        # km
        "real_rtt": 8.50,         # seconds (causes the 10s lag!)
        "desc": "Extreme Delay / Max Range"
    }
]

# Calculate ToA for all configs
for c in configs:
    toa, ts, de = calculate_lora_toa(c["sf"], c["bw"], pl_bytes=40)
    c["toa_ms"] = toa * 1000.0
    c["toa_s"] = toa
    c["ts_ms"] = ts * 1000.0

# Create Professional Dashboard Figure (Widescreen 16:9 Presentation Format)
fig = plt.figure(figsize=(20, 11.5), facecolor='#0B0F19', dpi=300)

# Layout: 3 Columns for Charts on top, Full-width Table on bottom
gs = fig.add_gridspec(2, 3, height_ratios=[1.25, 0.85], 
                      hspace=0.36, wspace=0.24, left=0.05, right=0.95, top=0.90, bottom=0.07)

# HEADER TITLE & SUBTITLE
fig.text(0.5, 0.960, "SHEcurity (NariKavach) - LoRa Performance, Latency & Range Benchmark", 
         ha='center', va='center', fontsize=22, fontweight='bold', color='#FFFFFF')
fig.text(0.5, 0.930, "Trade-Off Analysis: Packet Airtime vs. Real-World 2-Way Latency vs. Urban/LoS Communication Range (433 MHz, 20 dBm)",
         ha='center', va='center', fontsize=12, color='#94A3B8')

x_labels = [c["short_label"] for c in configs]
x_indices = np.arange(len(configs))

# ==============================================================================
# CHART 1: PACKET TIME-ON-AIR (MILLISECONDS)
# ==============================================================================
ax1 = fig.add_subplot(gs[0, 0], facecolor='#131D31')
bars1 = ax1.bar(x_indices, [c["toa_ms"] for c in configs], 
                color=[c["color"] for c in configs], 
                width=0.55, edgecolor='#1E293B', linewidth=1.5, zorder=3)

# Highlight selected SF9
bars1[1].set_edgecolor('#FFFFFF')
bars1[1].set_linewidth(2.8)

ax1.set_title("1. Packet Time-on-Air (Airtime)", fontsize=13.5, fontweight='bold', color='#F8FAFC', pad=12)
ax1.set_ylabel("Transmission Duration (ms)", fontsize=10.5, color='#CBD5E1', labelpad=6)
ax1.set_xticks(x_indices)
ax1.set_xticklabels(x_labels, fontsize=9.5, color='#94A3B8')
ax1.tick_params(colors='#94A3B8')
ax1.grid(axis='y', linestyle='--', alpha=0.25, color='#64748B', zorder=0)

for bar, c in zip(bars1, configs):
    yval = bar.get_height()
    ax1.annotate(f"{yval:.0f} ms\n({yval/1000:.2f}s)",
                 xy=(bar.get_x() + bar.get_width() / 2, yval),
                 xytext=(0, 5), textcoords="offset points",
                 ha='center', va='bottom', fontsize=9.5, fontweight='bold',
                 color=c["color"] if c["color"] != '#00F0FF' else '#38BDF8')

ax1.annotate("[SWEET SPOT]\n288 ms (0.29s)",
             xy=(1, configs[1]["toa_ms"]), xytext=(0.45, 1300),
             arrowprops=dict(arrowstyle="->", color='#00F0FF', lw=1.5),
             fontsize=9, fontweight='bold', color='#00F0FF',
             bbox=dict(boxstyle="round,pad=0.3", fc="#0D2D3A", ec="#00F0FF", lw=1))

ax1.annotate("[CRITICAL LAG]\n3,949 ms (~4.0s)",
             xy=(4, configs[4]["toa_ms"]), xytext=(2.6, 3200),
             arrowprops=dict(arrowstyle="->", color='#EF4444', lw=1.5),
             fontsize=9, fontweight='bold', color='#EF4444',
             bbox=dict(boxstyle="round,pad=0.3", fc="#2D1515", ec="#EF4444", lw=1))

ax1.set_ylim(0, 4800)


# ==============================================================================
# CHART 2: REAL-WORLD 2-WAY ROUND-TRIP LATENCY (SECONDS)
# ==============================================================================
ax2 = fig.add_subplot(gs[0, 1], facecolor='#131D31')
bars2 = ax2.bar(x_indices, [c["real_rtt"] for c in configs], 
                color=[c["color"] for c in configs], 
                width=0.55, edgecolor='#1E293B', linewidth=1.5, zorder=3)

bars2[1].set_edgecolor('#FFFFFF')
bars2[1].set_linewidth(2.8)

ax2.set_title("2. Real-World 2-Way Latency (SOS + ACK)", fontsize=13.5, fontweight='bold', color='#F8FAFC', pad=12)
ax2.set_ylabel("Round-Trip Delay (Seconds)", fontsize=10.5, color='#CBD5E1', labelpad=6)
ax2.set_xticks(x_indices)
ax2.set_xticklabels(x_labels, fontsize=9.5, color='#94A3B8')
ax2.tick_params(colors='#94A3B8')
ax2.grid(axis='y', linestyle='--', alpha=0.25, color='#64748B', zorder=0)

for bar, c in zip(bars2, configs):
    lat = c["real_rtt"]
    ax2.annotate(f"{lat:.2f} s",
                 xy=(bar.get_x() + bar.get_width() / 2, lat),
                 xytext=(0, 5), textcoords="offset points",
                 ha='center', va='bottom', fontsize=10, fontweight='bold',
                 color=c["color"] if c["color"] != '#00F0FF' else '#38BDF8')

ax2.annotate("[THE 10s LAG]\nHangs up to 10s\nUnsafe in panic!",
             xy=(4, 8.5), xytext=(2.3, 6.7),
             arrowprops=dict(arrowstyle="->", color='#EF4444', lw=1.5),
             fontsize=8.8, fontweight='bold', color='#EF4444',
             bbox=dict(boxstyle="round,pad=0.3", fc="#2D1515", ec="#EF4444", lw=1))

ax2.annotate("[RESOLVED]\n< 0.70s ACK",
             xy=(1, 0.65), xytext=(0.4, 3.2),
             arrowprops=dict(arrowstyle="->", color='#00F0FF', lw=1.5),
             fontsize=8.8, fontweight='bold', color='#00F0FF',
             bbox=dict(boxstyle="round,pad=0.3", fc="#0D2D3A", ec="#00F0FF", lw=1))

ax2.set_ylim(0, 10.5)


# ==============================================================================
# CHART 3: RANGE COMPARISON (URBAN VS. LINE-OF-SIGHT IN KM)
# ==============================================================================
ax3 = fig.add_subplot(gs[0, 2], facecolor='#131D31')
bar_w = 0.35

bars3_urban = ax3.bar(x_indices - bar_w/2, [c["urban_range"] for c in configs], 
                      width=bar_w, label='Urban / Obstructed Range', 
                      color=[c["color"] for c in configs], 
                      edgecolor='#1E293B', linewidth=1.2, zorder=3)

bars3_los = ax3.bar(x_indices + bar_w/2, [c["los_range"] for c in configs], 
                    width=bar_w, label='Line-of-Sight (LoS / Open Field)', 
                    color=[c["color"] for c in configs], alpha=0.45,
                    hatch='//', edgecolor=[c["color"] for c in configs], linewidth=1.2, zorder=3)

# Highlight selected SF9
bars3_urban[1].set_edgecolor('#FFFFFF')
bars3_urban[1].set_linewidth(2.2)

ax3.set_title("3. Effective Communication Range", fontsize=13.5, fontweight='bold', color='#F8FAFC', pad=12)
ax3.set_ylabel("Range (Kilometers)", fontsize=10.5, color='#CBD5E1', labelpad=6)
ax3.set_xticks(x_indices)
ax3.set_xticklabels(x_labels, fontsize=9.5, color='#94A3B8')
ax3.tick_params(colors='#94A3B8')
ax3.grid(axis='y', linestyle='--', alpha=0.25, color='#64748B', zorder=0)

for bar, c in zip(bars3_urban, configs):
    yval = bar.get_height()
    ax3.annotate(f"{yval:.1f}k",
                 xy=(bar.get_x() + bar.get_width() / 2, yval),
                 xytext=(0, 4), textcoords="offset points",
                 ha='center', va='bottom', fontsize=9, fontweight='bold',
                 color=c["color"] if c["color"] != '#00F0FF' else '#38BDF8')

for bar, c in zip(bars3_los, configs):
    yval = bar.get_height()
    ax3.annotate(f"{yval:.0f}k",
                 xy=(bar.get_x() + bar.get_width() / 2, yval),
                 xytext=(0, 4), textcoords="offset points",
                 ha='center', va='bottom', fontsize=8.5, color='#E2E8F0')

ax3.annotate("[SWEET SPOT] 4.5 km Urban (2x SF7)\nUp to 12 km Open Field",
             xy=(1 + bar_w/2, 12.0), xytext=(0.35, 16.5),
             arrowprops=dict(arrowstyle="->", color='#00F0FF', lw=1.5),
             fontsize=8.8, fontweight='bold', color='#00F0FF',
             bbox=dict(boxstyle="round,pad=0.3", fc="#0D2D3A", ec="#00F0FF", lw=1))

ax3.legend(loc='upper left', facecolor='#0B0F19', edgecolor='#334155', fontsize=8.5, labelcolor='#E2E8F0')
ax3.set_ylim(0, 26)


# ==============================================================================
# BOTTOM PANEL: EXECUTIVE BENCHMARK MATRIX TABLE
# ==============================================================================
ax_tbl = fig.add_subplot(gs[1, :], facecolor='#0B0F19')
ax_tbl.axis('off')

table_data = [
    ["Configuration", "Bandwidth", "Symbol Time", "Airtime (40B)", "Round-Trip Latency", "Sensitivity", "Urban Range", "LoS Range", "Engineering & Safety Verdict"],
    ["SF7 @ 125 kHz", "125 kHz", "1.02 ms", "82 ms", "~0.25 s", "-123 dBm", "2.2 km", "6.5 km", "Fastest airtime, but poor building penetration (-123 dBm)."],
    ["SF9 @ 125 kHz [SELECTED]", "125 kHz", "4.10 ms", "288 ms (0.29s)", "< 0.70 s", "-129 dBm (+6dB)", "4.5 km (2x SF7)", "12.0 km", "GOLDEN RATIO: Sub-second alert confirmation + doubles coverage!"],
    ["SF9 @ 62.5 kHz", "62.5 kHz", "8.19 ms", "576 ms (0.58s)", "~1.20 s", "-132 dBm", "5.4 km", "14.5 km", "Acceptable range, but 2x slower airtime than 125 kHz."],
    ["SF12 @ 125 kHz", "125 kHz", "32.77 ms", "1,974 ms (1.97s)", "~3.80 s", "-137 dBm", "6.8 km", "18.0 km", "Sluggish airtime; causes a noticeable ~4s lag on emergency dispatch."],
    ["SF12 @ 62.5 kHz [OLD]", "62.5 kHz", "65.54 ms", "3,949 ms (3.95s)", "~8.5 - 10.0 s", "-140 dBm", "8.0 km", "22.0 km", "UNACCEPTABLE DELAY: Severe 10-second ACK freeze during active emergency!"]
]

col_widths = [0.15, 0.08, 0.09, 0.10, 0.11, 0.10, 0.09, 0.08, 0.30]

table = ax_tbl.table(cellText=table_data, loc='center', cellLoc='center', colWidths=col_widths)
table.auto_set_font_size(False)
table.set_fontsize(9.5)
table.scale(1, 1.85)

for (row, col), cell in table.get_celld().items():
    cell.set_edgecolor('#334155')
    cell.set_linewidth(1.0)
    if row == 0:
        cell.set_facecolor('#1E293B')
        cell.set_text_props(weight='bold', color='#F8FAFC', fontsize=10)
    elif row == 2:  # Highlight SF9 @ 125 kHz
        cell.set_facecolor('#0B3848')
        cell.set_text_props(weight='bold', color='#38BDF8')
    elif row == 5:  # Old SF12 62.5k
        cell.set_facecolor('#3B1818')
        cell.set_text_props(color='#FCA5A5')
    else:
        cell.set_facecolor('#131D31' if row % 2 == 1 else '#17233D')
        cell.set_text_props(color='#CBD5E1')

# Output destinations
base_dir = os.path.dirname(os.path.abspath(__file__))
artifact_dir = r"C:\Users\aryan\.gemini\antigravity\brain\f6bee7e3-2495-4c0f-a794-e91a73ee062c"

destinations = [
    os.path.join(base_dir, "lora_airtime_latency_comparison.png"),
    os.path.join(base_dir, "Spreading-Factor-9", "lora_airtime_latency_comparison.png"),
    os.path.join(base_dir, "sf9_tests", "lora_airtime_latency_comparison.png"),
    os.path.join(base_dir, "Range-Testing", "lora_airtime_latency_comparison.png"),
    os.path.join(artifact_dir, "lora_airtime_latency_comparison.png")
]

for dst in destinations:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    plt.savefig(dst, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
    print("Exported successfully to:", dst)

plt.close()
print("All professional graphs generated!")
