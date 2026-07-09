export const CollisionCategory = {
  STATIC_PIECE: 0x0001,
  MARBLE: 0x0002,
  GOAL_ZONE: 0x0004,
  SENSOR: 0x0008,
} as const;

export const CollisionMask = {
  STATIC_PIECE: CollisionCategory.MARBLE,
  MARBLE: CollisionCategory.STATIC_PIECE | CollisionCategory.GOAL_ZONE,
  GOAL_ZONE: CollisionCategory.MARBLE,
  SENSOR: CollisionCategory.MARBLE,
} as const;