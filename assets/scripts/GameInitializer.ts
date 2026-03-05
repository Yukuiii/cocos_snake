import { _decorator, Component, Node, warn } from 'cc';
import { FoodBlockSpawner } from './FoodBlockSpawner';

const { ccclass, property } = _decorator;

/**
 * 游戏初始化组件：
 * 挂在 Canvas 上，负责管理“开局初始化”相关逻辑。
 * 当前包含随机食物方块的首次生成与资源回收。
 */
@ccclass('GameInitializer')
export class GameInitializer extends Component {
    @property({ type: Node, tooltip: '蛇头节点引用（建议拖拽 scene 中的 snake_head 节点）。' })
    public snakeHeadNode: Node | null = null;

    @property({ tooltip: '食物方块边长（像素），建议与蛇头尺寸一致。' })
    public foodSize = 32;

    @property({ tooltip: '食物生成时与边界保留的像素间距。' })
    public foodPadding = 0;

    @property({ tooltip: '生成食物时最多尝试次数（用于避开蛇头初始位置）。' })
    public foodSpawnMaxTries = 50;

    private _foodSpawner: FoodBlockSpawner | null = null;

    /**
     * 组件启动时执行开局初始化。
     */
    start(): void {
        this.initialize();
    }

    /**
     * 组件销毁时回收运行时资源。
     */
    onDestroy(): void {
        this.dispose();
    }

    /**
     * 执行游戏初始化流程（当前为首次随机食物生成）。
     */
    public initialize(): void {
        const snakeHeadNode = this.resolveSnakeHeadNode();
        if (!snakeHeadNode) {
            return;
        }

        this._foodSpawner ??= new FoodBlockSpawner(this.foodSize, this.foodPadding, this.foodSpawnMaxTries);
        this._foodSpawner.spawnOnce(this.node, snakeHeadNode);
    }

    /**
     * 释放初始化组件持有的运行时资源。
     */
    public dispose(): void {
        if (this._foodSpawner) {
            this._foodSpawner.destroy();
            this._foodSpawner = null;
        }
    }

    /**
     * 解析蛇头节点：
     * 1. 优先使用面板配置的 `snakeHeadNode`；
     * 2. 若未配置，则尝试在 Canvas 下按名称查找 `snake_head`。
     */
    private resolveSnakeHeadNode(): Node | null {
        if (this.snakeHeadNode && this.snakeHeadNode.isValid) {
            return this.snakeHeadNode;
        }

        const fallbackNode = this.node.getChildByName('snake_head');
        if (fallbackNode && fallbackNode.isValid) {
            return fallbackNode;
        }

        warn('[GameInitializer] 未找到 snakeHeadNode，请在 Canvas 组件中绑定 snake_head 节点。');
        return null;
    }
}
