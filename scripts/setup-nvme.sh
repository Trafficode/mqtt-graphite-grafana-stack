#!/bin/bash
# Setup NVMe disk for monitoring data storage

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "NVMe Storage Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo ./scripts/setup-nvme.sh"
    exit 1
fi

# Check if already mounted and configured
if mount | grep -q "/mnt/nvme"; then
    echo -e "${GREEN}✓ NVMe already mounted at /mnt/nvme${NC}"
    df -h /mnt/nvme
    
    if [ -d "/mnt/nvme/monitoring-data" ]; then
        echo -e "${GREEN}✓ monitoring-data directory exists${NC}"
        echo ""
        echo "NVMe is already configured. Nothing to do."
        echo "To reconfigure, first unmount: sudo umount /mnt/nvme"
        exit 0
    fi
fi

# Detect NVMe device
NVME_DEVICE=$(lsblk -d -o NAME,TYPE | grep nvme | awk '{print $1}' | head -1)

if [ -z "$NVME_DEVICE" ]; then
    echo -e "${RED}No NVMe device found${NC}"
    echo "Available disks:"
    lsblk -d -o NAME,SIZE,TYPE,MODEL
    exit 1
fi

NVME_PATH="/dev/$NVME_DEVICE"
echo -e "${GREEN}Found NVMe device: $NVME_PATH${NC}"

# Show disk info
NVME_SIZE=$(lsblk -d -o SIZE -n $NVME_PATH)
NVME_MODEL=$(lsblk -d -o MODEL -n $NVME_PATH)
echo "  Size: $NVME_SIZE"
echo "  Model: $NVME_MODEL"
echo ""

# Check if already mounted
if mount | grep -q "/mnt/nvme"; then
    echo -e "${YELLOW}NVMe already mounted at /mnt/nvme${NC}"
    df -h /mnt/nvme
    exit 0
fi

# Warning prompt
echo -e "${YELLOW}WARNING: This will format the entire NVMe disk!${NC}"
echo -e "${YELLOW}All existing data will be lost!${NC}"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Unmount if mounted elsewhere
if mount | grep -q "$NVME_PATH"; then
    echo "Unmounting existing mounts..."
    umount ${NVME_PATH}* 2>/dev/null || true
fi

# Create partition table and partition
echo "Creating GPT partition table..."
parted -s $NVME_PATH mklabel gpt

echo "Creating partition..."
parted -s $NVME_PATH mkpart primary ext4 0% 100%

# Wait for kernel to recognize the partition
sleep 2

PARTITION="${NVME_PATH}p1"

# Format the partition
echo "Formatting $PARTITION as ext4..."
mkfs.ext4 -F -L nvme-storage $PARTITION

# Create mount point
echo "Creating mount point /mnt/nvme..."
mkdir -p /mnt/nvme

# Mount the partition
echo "Mounting partition..."
mount $PARTITION /mnt/nvme

# Get UUID for fstab
UUID=$(blkid -s UUID -o value $PARTITION)

# Add to fstab for automatic mounting
echo "Adding to /etc/fstab for auto-mount on boot..."
if ! grep -q "$UUID" /etc/fstab; then
    echo "UUID=$UUID /mnt/nvme ext4 defaults,noatime 0 2" >> /etc/fstab
    echo -e "${GREEN}Added to /etc/fstab${NC}"
else
    echo -e "${YELLOW}Already in /etc/fstab${NC}"
fi

# Create monitoring-data directory
echo "Creating /mnt/nvme/monitoring-data..."
mkdir -p /mnt/nvme/monitoring-data

# Set proper ownership
SETUP_USER=$(logname 2>/dev/null || echo $SUDO_USER)
if [ -n "$SETUP_USER" ]; then
    chown -R $SETUP_USER:$SETUP_USER /mnt/nvme
    echo -e "${GREEN}Set ownership to $SETUP_USER${NC}"
fi

chmod 755 /mnt/nvme
chmod 755 /mnt/nvme/monitoring-data

echo ""
echo "=========================================="
echo -e "${GREEN}NVMe setup completed successfully!${NC}"
echo "=========================================="
echo ""
echo "NVMe mounted at: /mnt/nvme"
echo "Monitoring data: /mnt/nvme/monitoring-data"
echo ""
df -h /mnt/nvme
echo ""
echo -e "${GREEN}✓ Disk will auto-mount on boot (configured in /etc/fstab)${NC}"
echo ""
echo "Next steps:"
echo "1. Update config.json to use /mnt/nvme/monitoring-data"
echo "2. Run ./scripts/setup.sh to configure services"
echo ""
