import { Color, Graphics, Layers, Node, UITransform, Vec2, Vec3 } from 'cc';

/**
 * 随机食物方块生成器：
 * 1. 在指定 UI 容器内创建一个食物节点（Graphics 绘制方块）。
 * 2. 按 `foodSize` 网格对齐，随机选择一个位置摆放。
 * 3. 生成时尽量避开蛇头初始占用区域，避免“开局就吃到”的观感问题。
 */
export class FoodBlockSpawner {
    private _foodNode: Node | null = null;

    public constructor(
        private readonly _foodSize: number,
        private readonly _foodPadding: number,
        private readonly _maxTries: number,
        private readonly _fillColor: Readonly<Color> = new Color(255, 70, 70, 255),
    ) {}

    /**
     * 获取当前食物节点（可能为空）。
     */
    public get foodNode(): Node | null {
        return this._foodNode && this._foodNode.isValid ? this._foodNode : null;
    }

    /**
     * 在 `boardNode` 范围内生成一次随机食物方块。
     * @param boardNode 食物承载节点（通常为 Canvas）
     * @param snakeNode 蛇头节点（用于避开初始重叠）
     */
    public spawnOnce(boardNode: Node, snakeNode: Node): void {
        const boardTransform = boardNode.getComponent(UITransform);
        const snakeTransform = snakeNode.getComponent(UITransform);
        if (!boardTransform || !snakeTransform) {
            return;
        }

        const foodNode = this.ensureFoodNode(boardNode);
        const randomPos = this.pickRandomFoodPosition(boardTransform, snakeNode.position, snakeTransform);
        if (!randomPos) {
            return;
        }

        foodNode.setPosition(randomPos);
    }

    /**
     * 回收生成的食物节点。
     */
    public destroy(): void {
        if (!this._foodNode) {
            return;
        }

        if (this._foodNode.isValid) {
            this._foodNode.destroy();
        }
        this._foodNode = null;
    }

    /**
     * 确保食物节点存在；若不存在则创建一个使用 Graphics 绘制的红色方块。
     * @param parent 食物节点挂载的父节点（通常为 Canvas）
     */
    private ensureFoodNode(parent: Node): Node {
        const existingNode = this.foodNode;
        if (existingNode) {
            return existingNode;
        }

        const foodNode = new Node('food');
        foodNode.layer = Layers.Enum.UI_2D;
        foodNode.parent = parent;

        const foodTransform = foodNode.addComponent(UITransform);
        foodTransform.setContentSize(this._foodSize, this._foodSize);
        foodTransform.anchorPoint = new Vec2(0.5, 0.5);

        const graphics = foodNode.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = new Color(this._fillColor.r, this._fillColor.g, this._fillColor.b, this._fillColor.a);

        const half = this._foodSize * 0.5;
        // 以节点锚点为中心绘制方块，便于用 position 表达中心点。
        graphics.rect(-half, -half, this._foodSize, this._foodSize);
        graphics.fill();

        this._foodNode = foodNode;
        return foodNode;
    }

    /**
     * 在父节点的可用范围内随机选择一个对齐到方块网格的位置，且尽量避开蛇头当前占用区域。
     * @param boardTransform 父节点 UITransform（用于获取边界尺寸）
     * @param snakeLocalPos 蛇头在父节点坐标系下的位置
     * @param snakeTransform 蛇头 UITransform（用于避开初始重叠）
     * @returns 食物中心点在父节点局部坐标系下的位置；若无法生成返回 null
     */
    private pickRandomFoodPosition(
        boardTransform: UITransform,
        snakeLocalPos: Readonly<Vec3>,
        snakeTransform: UITransform,
    ): Vec3 | null {
        const boardSize = boardTransform.contentSize;
        const boardAnchor = boardTransform.anchorPoint;
        const foodHalf = this._foodSize * 0.5;

        // 可用边界（以父节点锚点为原点；anchor 为 (0.5,0.5) 时等价于居中坐标系）。
        const left = -boardSize.width * boardAnchor.x;
        const right = boardSize.width * (1 - boardAnchor.x);
        const bottom = -boardSize.height * boardAnchor.y;
        const top = boardSize.height * (1 - boardAnchor.y);

        const minX = left + foodHalf + this._foodPadding;
        const maxX = right - foodHalf - this._foodPadding;
        const minY = bottom + foodHalf + this._foodPadding;
        const maxY = top - foodHalf - this._foodPadding;

        if (maxX < minX || maxY < minY) {
            return null;
        }

        // 将位置对齐到 foodSize 网格，避免出现“半格”坐标，后续做格子蛇更好接。
        const usableWidth = maxX - minX;
        const usableHeight = maxY - minY;
        const cols = Math.floor(usableWidth / this._foodSize) + 1;
        const rows = Math.floor(usableHeight / this._foodSize) + 1;

        if (cols <= 0 || rows <= 0) {
            return null;
        }

        const snakeAabb = this.getAabbInParentSpace(snakeLocalPos, snakeTransform);

        for (let attempt = 0; attempt < this._maxTries; attempt++) {
            const col = Math.floor(Math.random() * cols);
            const row = Math.floor(Math.random() * rows);

            const x = minX + col * this._foodSize;
            const y = minY + row * this._foodSize;
            const candidatePos = new Vec3(x, y, 0);

            const foodAabb = {
                left: x - foodHalf,
                right: x + foodHalf,
                bottom: y - foodHalf,
                top: y + foodHalf,
            };

            // 避免食物初始就刷在蛇头上（或与其相交），否则看起来像“凭空吃掉”。
            if (!this.isAabbIntersect(snakeAabb, foodAabb)) {
                return candidatePos;
            }
        }

        // 尝试失败则退化为任意位置（仍保证在边界内且对齐）。
        const fallbackCol = Math.floor(Math.random() * cols);
        const fallbackRow = Math.floor(Math.random() * rows);
        return new Vec3(minX + fallbackCol * this._foodSize, minY + fallbackRow * this._foodSize, 0);
    }

    /**
     * 计算 UITransform 在父节点局部坐标系下的 AABB（轴对齐包围盒）。
     * @param localPos 节点在父节点坐标系下的位置
     * @param transform 节点的 UITransform
     */
    private getAabbInParentSpace(
        localPos: Readonly<Vec3>,
        transform: UITransform,
    ): { left: number; right: number; bottom: number; top: number } {
        const size = transform.contentSize;
        const anchor = transform.anchorPoint;

        const left = localPos.x - size.width * anchor.x;
        const bottom = localPos.y - size.height * anchor.y;

        return {
            left,
            right: left + size.width,
            bottom,
            top: bottom + size.height,
        };
    }

    /**
     * 判断两个 AABB 是否相交。
     */
    private isAabbIntersect(
        a: { left: number; right: number; bottom: number; top: number },
        b: { left: number; right: number; bottom: number; top: number },
    ): boolean {
        // 任何一边分离则不相交。
        if (a.right <= b.left || b.right <= a.left) {
            return false;
        }
        if (a.top <= b.bottom || b.top <= a.bottom) {
            return false;
        }
        return true;
    }
}

